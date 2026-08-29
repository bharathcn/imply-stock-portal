using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

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
            await ExecuteWithRetryAsync(token => cloud.SendSnapshotAsync(snapshot, token), "snapshot", cancellationToken);
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
        try
        {
            await ExecuteWithRetryAsync(
                token => cloud.SendHeartbeatAsync(new Heartbeat(_options.ConnectorId, Version, _options.TallyCompanyName, null, status, _lastSuccessfulSyncAt), token),
                "heartbeat",
                cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Heartbeat upload failed after retries. The connector will continue running.");
        }
    }

    private async Task ExecuteWithRetryAsync(Func<CancellationToken, Task> action, string operation, CancellationToken cancellationToken)
    {
        const int maxAttempts = 4;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await action(cancellationToken);
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts && IsTransient(ex))
            {
                var delay = GetRetryDelay(ex, attempt);
                logger.LogWarning(ex, "Transient connector API {Operation} failure on attempt {Attempt}. Retrying in {DelaySeconds:n1}s.", operation, attempt, delay.TotalSeconds);
                await Task.Delay(delay, cancellationToken);
            }
        }
    }

    private static bool IsTransient(Exception ex) => ex switch
    {
        ConnectorApiException apiException => apiException.IsTransient,
        HttpRequestException => true,
        TaskCanceledException => true,
        _ => false
    };

    private static TimeSpan GetRetryDelay(Exception ex, int attempt)
    {
        if (ex is ConnectorApiException { RetryAfter: { } retryAfter } && retryAfter > TimeSpan.Zero)
        {
            return retryAfter;
        }

        return TimeSpan.FromSeconds(Math.Pow(2, attempt));
    }
}
