using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Imply.TallyConnector;

public interface ICloudApiClient
{
    Task SendSnapshotAsync(InventorySnapshot snapshot, CancellationToken cancellationToken);
    Task SendHeartbeatAsync(Heartbeat heartbeat, CancellationToken cancellationToken);
}

public sealed class CloudApiClient(HttpClient httpClient, IOptions<ConnectorOptions> options, ILogger<CloudApiClient> logger) : ICloudApiClient
{
    private readonly ConnectorOptions _options = options.Value;
    public const int MaxLoggedResponseBodyLength = 4096;

    public static readonly JsonSerializerOptions PayloadJsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new DecimalStringJsonConverter(), new UtcDateTimeOffsetJsonConverter() }
    };

    public async Task SendSnapshotAsync(InventorySnapshot snapshot, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, CreateEndpointUri("/api/connector/snapshot"))
        {
            Content = JsonContent.Create(snapshot, options: PayloadJsonOptions)
        };
        AddConnectorSecretHeader(request);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, "snapshot", cancellationToken);
    }

    public async Task SendHeartbeatAsync(Heartbeat heartbeat, CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, CreateEndpointUri("/api/connector/heartbeat"))
        {
            Content = JsonContent.Create(heartbeat, options: PayloadJsonOptions)
        };
        AddConnectorSecretHeader(request);
        using var response = await httpClient.SendAsync(request, cancellationToken);
        await EnsureSuccessAsync(response, "heartbeat", cancellationToken);
    }

    private Uri CreateEndpointUri(string path)
    {
        if (!Uri.TryCreate(_options.CloudApiBaseUrl, UriKind.Absolute, out var baseUri))
        {
            throw new InvalidOperationException("Connector:CloudApiBaseUrl must be a valid absolute URL.");
        }

        return new Uri(baseUri, path);
    }

    private void AddConnectorSecretHeader(HttpRequestMessage request)
    {
        if (!string.IsNullOrWhiteSpace(_options.ConnectorSecret))
        {
            request.Headers.Add("x-connector-secret", _options.ConnectorSecret);
        }
    }

    private async Task EnsureSuccessAsync(HttpResponseMessage response, string operation, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode) return;

        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        var safeBody = RedactForLog(raw, _options.ConnectorSecret);
        var safeMessage = TryExtractApiMessage(safeBody) ?? safeBody;
        var exception = new ConnectorApiException(
            $"Connector API {operation} failed with HTTP {(int)response.StatusCode} {response.ReasonPhrase}: {safeMessage}",
            response.StatusCode,
            safeBody,
            response.Headers.RetryAfter?.Delta);

        logger.LogWarning(
            "Connector API {Operation} failed with HTTP {StatusCode}. Transient={Transient}. Response={ResponseBody}",
            operation,
            (int)response.StatusCode,
            exception.IsTransient,
            safeBody);

        throw exception;
    }

    private static string? TryExtractApiMessage(string responseBody)
    {
        try
        {
            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return null;
            if (root.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.String)
            {
                return error.GetString();
            }
            if (root.TryGetProperty("message", out var message) && message.ValueKind == JsonValueKind.String)
            {
                return message.GetString();
            }
        }
        catch (JsonException)
        {
            return null;
        }

        return null;
    }

    public static string RedactForLog(string? value, string? connectorSecret = null)
    {
        if (string.IsNullOrEmpty(value)) return "";

        var result = value;
        if (!string.IsNullOrEmpty(connectorSecret))
        {
            result = result.Replace(connectorSecret, "[REDACTED]");
        }

        result = System.Text.RegularExpressions.Regex.Replace(
            result,
            "(?i)(authorization|x-connector-secret|api[_-]?key|service[_-]?role[_-]?key|password|token|secret)(\"?\\s*[:=]\\s*\"?)[^\"\\s,}]+",
            "$1$2[REDACTED]");

        return result.Length <= MaxLoggedResponseBodyLength
            ? result
            : string.Concat(result.AsSpan(0, MaxLoggedResponseBodyLength), "...[truncated]");
    }
}

public sealed class ConnectorApiException : HttpRequestException
{
    public ConnectorApiException(string message, System.Net.HttpStatusCode statusCode, string safeResponseBody, TimeSpan? retryAfter)
        : base(message, null, statusCode)
    {
        SafeResponseBody = safeResponseBody;
        RetryAfter = retryAfter;
    }

    public string SafeResponseBody { get; }
    public TimeSpan? RetryAfter { get; }
    public bool IsTransient => StatusCode is System.Net.HttpStatusCode.RequestTimeout
        or (System.Net.HttpStatusCode)429
        or System.Net.HttpStatusCode.InternalServerError
        or System.Net.HttpStatusCode.BadGateway
        or System.Net.HttpStatusCode.ServiceUnavailable
        or System.Net.HttpStatusCode.GatewayTimeout;
}

public sealed class UtcDateTimeOffsetJsonConverter : JsonConverter<DateTimeOffset>
{
    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.GetDateTimeOffset();

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.UtcDateTime.ToString("O", System.Globalization.CultureInfo.InvariantCulture));
}

public sealed class DecimalStringJsonConverter : JsonConverter<decimal>
{
    public override decimal Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        reader.TokenType switch
        {
            JsonTokenType.String when decimal.TryParse(reader.GetString(), System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var value) => value,
            JsonTokenType.Number => reader.GetDecimal(),
            _ => throw new JsonException("Expected decimal string or number.")
        };

    public override void Write(Utf8JsonWriter writer, decimal value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture));
}
