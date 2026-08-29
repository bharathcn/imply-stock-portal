using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Polly;

namespace Imply.TallyConnector;

public sealed class ConnectorWorker(ITallyInventoryReader reader, ICloudApiClient cloud, IOptions<ConnectorOptions> options, ILogger<ConnectorWorker> logger) : BackgroundService
{
    private readonly ConnectorOptions _options = options.Value;
    private DateTimeOffset? _lastSuccessfulSyncAt;
    private const string Version = "0.1.0";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await SyncOnceAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(_options.SyncIntervalSeconds), stoppingToken);
        }
    }

    public async Task SyncOnceAsync(CancellationToken cancellationToken)
    {
        var started = DateTimeOffset.UtcNow;
        try
        {
            var items = await reader.ReadInventoryAsync(cancellationToken);
            if (items.Count == 0) throw new InvalidOperationException("Tally returned no stock items; upload skipped.");
            var snapshot = new InventorySnapshot(_options.ConnectorId, Guid.NewGuid(), _options.TallyCompanyName, started, DateTimeOffset.UtcNow, Version, null, items);
            var retry = Policy.Handle<HttpRequestException>().Or<TaskCanceledException>().WaitAndRetryAsync(3, attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)));
            await retry.ExecuteAsync(token => cloud.SendSnapshotAsync(snapshot, token), cancellationToken);
            _lastSuccessfulSyncAt = snapshot.SyncCompletedAt;
            await SendHeartbeatSafelyAsync("healthy", cancellationToken);
            logger.LogInformation("Uploaded inventory snapshot with {ItemCount} items.", items.Count);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Sync failed. Last successful cloud snapshot remains unchanged.");
            await SendHeartbeatSafelyAsync("sync_failed", cancellationToken);
        }
    }

    private async Task SendHeartbeatSafelyAsync(string status, CancellationToken cancellationToken)
    {
        var retry = Policy.Handle<Exception>().WaitAndRetryAsync(3, attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)));
        try
        {
            await retry.ExecuteAsync(token => cloud.SendHeartbeatAsync(new Heartbeat(_options.ConnectorId, Version, _options.TallyCompanyName, null, status, _lastSuccessfulSyncAt), token), cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Heartbeat upload failed after retries. The connector will continue running.");
        }
    }
}
