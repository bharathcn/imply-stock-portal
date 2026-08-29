using Microsoft.Extensions.Options;

namespace Imply.TallyConnector;

public sealed class TallyHttpClient(HttpClient httpClient, IOptions<ConnectorOptions> options)
{
    private readonly ConnectorOptions _options = options.Value;

    public async Task<TallyHttpResponse> PostAsync(string body, string contentType, CancellationToken cancellationToken)
    {
        if (!Uri.TryCreate(_options.TallyLocalUrl, UriKind.Absolute, out var tallyUri))
        {
            throw new InvalidOperationException("Connector:TallyLocalUrl must be a valid absolute URL.");
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(_options.HttpTimeoutSeconds));
        using var content = new StringContent(body, System.Text.Encoding.UTF8, contentType);
        using var response = await httpClient.PostAsync(tallyUri, content, timeout.Token);
        var responseBody = await response.Content.ReadAsStringAsync(timeout.Token);
        return new TallyHttpResponse((int)response.StatusCode, response.Content.Headers.ContentType?.MediaType, responseBody, body);
    }
}
