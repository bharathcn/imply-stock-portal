using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace Imply.TallyConnector;

public interface ICloudApiClient
{
    Task SendSnapshotAsync(InventorySnapshot snapshot, CancellationToken cancellationToken);
    Task SendHeartbeatAsync(Heartbeat heartbeat, CancellationToken cancellationToken);
}

public sealed class CloudApiClient(HttpClient httpClient, IOptions<ConnectorOptions> options) : ICloudApiClient
{
    private readonly ConnectorOptions _options = options.Value;

    public async Task SendSnapshotAsync(InventorySnapshot snapshot, CancellationToken cancellationToken)
    {
        httpClient.BaseAddress = CreateCloudBaseUri();
        httpClient.Timeout = TimeSpan.FromSeconds(_options.HttpTimeoutSeconds);
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/connector/snapshot")
        {
            Content = JsonContent.Create(snapshot)
        };
        request.Headers.Add("x-connector-secret", _options.ConnectorSecret);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    public async Task SendHeartbeatAsync(Heartbeat heartbeat, CancellationToken cancellationToken)
    {
        httpClient.BaseAddress = CreateCloudBaseUri();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/connector/heartbeat")
        {
            Content = JsonContent.Create(heartbeat)
        };
        request.Headers.Add("x-connector-secret", _options.ConnectorSecret);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();
    }

    private Uri CreateCloudBaseUri()
    {
        if (!Uri.TryCreate(_options.CloudApiBaseUrl, UriKind.Absolute, out var uri))
        {
            throw new InvalidOperationException("Connector:CloudApiBaseUrl must be a valid absolute URL.");
        }
        return uri;
    }
}
