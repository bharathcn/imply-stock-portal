using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Imply.TallyConnector.Tests;

public sealed class CloudApiClientTests
{
    [Fact]
    public async Task SendSnapshotDoesNotModifyBaseAddressAfterRequests()
    {
        var handler = new RecordingHandler(
            new HttpResponseMessage(HttpStatusCode.OK),
            new HttpResponseMessage(HttpStatusCode.OK));
        using var httpClient = new HttpClient(handler) { BaseAddress = new Uri("https://existing.example.invalid") };
        var client = CreateClient(httpClient);

        await client.SendSnapshotAsync(CreateSnapshot(), CancellationToken.None);
        await client.SendHeartbeatAsync(CreateHeartbeat(), CancellationToken.None);

        Assert.Equal("https://existing.example.invalid/", httpClient.BaseAddress?.ToString());
        Assert.Equal("https://portal.example.invalid/api/connector/snapshot", handler.Requests[0].RequestUri?.ToString());
        Assert.Equal("https://portal.example.invalid/api/connector/heartbeat", handler.Requests[1].RequestUri?.ToString());
    }

    [Fact]
    public async Task TransientFailureCanBeRetriedWithSameHttpClient()
    {
        var handler = new RecordingHandler(
            JsonResponse(HttpStatusCode.ServiceUnavailable, """{"error":"Temporary"}"""),
            new HttpResponseMessage(HttpStatusCode.OK),
            new HttpResponseMessage(HttpStatusCode.OK));
        using var httpClient = new HttpClient(handler);
        var worker = new ConnectorWorker(
            new FakeReader([new TallyStockItem("IMPLY ROYAL", 1, "sheets", [])]),
            CreateClient(httpClient),
            Options.Create(new ConnectorOptions { CloudApiBaseUrl = "https://portal.example.invalid", ConnectorId = "office-main", TallyCompanyName = "Demo" }),
            NullLogger<ConnectorWorker>.Instance);

        await worker.SyncOnceAsync(CancellationToken.None);

        Assert.Equal(3, handler.Requests.Count);
        Assert.Equal("/api/connector/snapshot", handler.Requests[0].RequestUri?.AbsolutePath);
        Assert.Equal("/api/connector/snapshot", handler.Requests[1].RequestUri?.AbsolutePath);
        Assert.Equal("/api/connector/heartbeat", handler.Requests[2].RequestUri?.AbsolutePath);
    }

    [Fact]
    public async Task Http400IsNotRetriedAndSafeDetailsAreSurfaced()
    {
        var handler = new RecordingHandler(JsonResponse(HttpStatusCode.BadRequest, "{\"error\":\"Invalid payload\",\"details\":{\"fieldErrors\":{\"items\":[\"Expected string\"]}},\"secret\":\"should-not-leak\"}"));
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);
        var previous = Environment.GetEnvironmentVariable("IMPLY_CONNECTOR_SECRET");
        Environment.SetEnvironmentVariable("IMPLY_CONNECTOR_SECRET", "should-not-leak");
        ConnectorApiException exception;
        try
        {
            exception = await Assert.ThrowsAsync<ConnectorApiException>(() => client.SendSnapshotAsync(CreateSnapshot(), CancellationToken.None));
        }
        finally
        {
            Environment.SetEnvironmentVariable("IMPLY_CONNECTOR_SECRET", previous);
        }

        Assert.False(exception.IsTransient);
        Assert.Equal(HttpStatusCode.BadRequest, exception.StatusCode);
        Assert.Contains("Invalid payload", exception.Message);
        Assert.Contains("Expected string", exception.SafeResponseBody);
        Assert.DoesNotContain("should-not-leak", exception.SafeResponseBody);
        Assert.Single(handler.Requests);
    }

    [Fact]
    public async Task WorkerDoesNotRetryHttp400SnapshotFailure()
    {
        var handler = new RecordingHandler(
            JsonResponse(HttpStatusCode.BadRequest, "{\"error\":\"Invalid payload\"}"),
            new HttpResponseMessage(HttpStatusCode.OK));
        using var httpClient = new HttpClient(handler);
        var worker = new ConnectorWorker(
            new FakeReader([new TallyStockItem("IMPLY ROYAL", 1, "sheets", [])]),
            CreateClient(httpClient),
            Options.Create(new ConnectorOptions { CloudApiBaseUrl = "https://portal.example.invalid", ConnectorId = "office-main", TallyCompanyName = "Demo" }),
            NullLogger<ConnectorWorker>.Instance);

        await worker.SyncOnceAsync(CancellationToken.None);

        Assert.Equal(2, handler.Requests.Count);
        Assert.Equal("/api/connector/snapshot", handler.Requests[0].RequestUri?.AbsolutePath);
        Assert.Equal("/api/connector/heartbeat", handler.Requests[1].RequestUri?.AbsolutePath);
    }

    [Fact]
    public void RedactForLogRemovesSecretsAndLimitsLength()
    {
        var raw = "authorization=Bearer abc x-connector-secret=my-secret token=abc " + new string('x', CloudApiClient.MaxLoggedResponseBodyLength + 100);

        var safe = CloudApiClient.RedactForLog(raw, "my-secret");

        Assert.DoesNotContain("my-secret", safe);
        Assert.DoesNotContain("Bearer abc", safe);
        Assert.Contains("[REDACTED]", safe);
        Assert.True(safe.Length <= CloudApiClient.MaxLoggedResponseBodyLength + "...[truncated]".Length);
    }

    [Fact]
    public void SerializedSnapshotMatchesPortalSchemaShape()
    {
        var json = JsonSerializer.Serialize(CreateSnapshot(), CloudApiClient.PayloadJsonOptions);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.True(root.TryGetProperty("connectorId", out _));
        Assert.True(root.TryGetProperty("syncStartedAt", out _));
        Assert.Equal(JsonValueKind.String, root.GetProperty("items")[0].GetProperty("totalQuantity").ValueKind);
        Assert.Equal("1.25", root.GetProperty("items")[0].GetProperty("totalQuantity").GetString());
        Assert.Equal(JsonValueKind.String, root.GetProperty("items")[0].GetProperty("godowns")[0].GetProperty("quantity").ValueKind);
    }

    [Fact]
    public async Task HttpBodiesOmitUnknownOptionalFields()
    {
        var handler = new RecordingHandler(
            new HttpResponseMessage(HttpStatusCode.OK),
            new HttpResponseMessage(HttpStatusCode.OK));
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        await client.SendSnapshotAsync(CreateSnapshot(), CancellationToken.None);
        await client.SendHeartbeatAsync(CreateHeartbeat() with { LastSuccessfulSyncAt = null }, CancellationToken.None);

        using var snapshot = JsonDocument.Parse(handler.RequestBodies[0]);
        Assert.False(snapshot.RootElement.TryGetProperty("tallyRelease", out _));
        using var heartbeat = JsonDocument.Parse(handler.RequestBodies[1]);
        Assert.False(heartbeat.RootElement.TryGetProperty("tallyRelease", out _));
        Assert.False(heartbeat.RootElement.TryGetProperty("lastSuccessfulSyncAt", out _));
        Assert.Equal("healthy", heartbeat.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task HttpHeartbeatPreservesKnownOptionalFields()
    {
        var handler = new RecordingHandler(new HttpResponseMessage(HttpStatusCode.OK));
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);

        await client.SendHeartbeatAsync(CreateHeartbeat() with { TallyRelease = "7.1" }, CancellationToken.None);

        using var heartbeat = JsonDocument.Parse(handler.RequestBodies.Single());
        Assert.Equal("7.1", heartbeat.RootElement.GetProperty("tallyRelease").GetString());
        Assert.Equal(JsonValueKind.String, heartbeat.RootElement.GetProperty("lastSuccessfulSyncAt").ValueKind);
    }

    [Theory]
    [InlineData("2026-10-15T14:34:23.1234567+05:30", "2026-10-15T09:04:23.1234567Z")]
    [InlineData("2026-10-15T09:04:23.1234567+00:00", "2026-10-15T09:04:23.1234567Z")]
    [InlineData("2026-10-15T05:04:23.1234567-04:00", "2026-10-15T09:04:23.1234567Z")]
    public async Task FinalHttpTimestampsUseUtcZFormat(string input, string expected)
    {
        var handler = new RecordingHandler(
            new HttpResponseMessage(HttpStatusCode.OK),
            new HttpResponseMessage(HttpStatusCode.OK));
        using var httpClient = new HttpClient(handler);
        var client = CreateClient(httpClient);
        var instant = DateTimeOffset.Parse(input, System.Globalization.CultureInfo.InvariantCulture);

        await client.SendSnapshotAsync(CreateSnapshot() with { SyncStartedAt = instant, SyncCompletedAt = instant }, CancellationToken.None);
        await client.SendHeartbeatAsync(CreateHeartbeat() with { LastSuccessfulSyncAt = instant }, CancellationToken.None);

        using var snapshot = JsonDocument.Parse(handler.RequestBodies[0]);
        Assert.Equal(expected, snapshot.RootElement.GetProperty("syncStartedAt").GetString());
        Assert.Equal(expected, snapshot.RootElement.GetProperty("syncCompletedAt").GetString());
        using var heartbeat = JsonDocument.Parse(handler.RequestBodies[1]);
        Assert.Equal(expected, heartbeat.RootElement.GetProperty("lastSuccessfulSyncAt").GetString());
    }

    private static CloudApiClient CreateClient(HttpClient httpClient) => new(
        httpClient,
        Options.Create(new ConnectorOptions { CloudApiBaseUrl = "https://portal.example.invalid", ConnectorId = "office-main", TallyCompanyName = "Demo" }),
        NullLogger<CloudApiClient>.Instance);

    private static InventorySnapshot CreateSnapshot() => new(
        "office-main",
        Guid.Parse("11111111-1111-4111-8111-111111111111"),
        "Demo",
        DateTimeOffset.Parse("2026-08-20T10:00:00.000Z"),
        DateTimeOffset.Parse("2026-08-20T10:00:10.000Z"),
        "0.1.0",
        null,
        [new TallyStockItem("IMPLY ROYAL", 1.25m, "sheets", [new GodownQuantity("Main", -0.5m)])]);

    private static Heartbeat CreateHeartbeat() => new("office-main", "0.1.0", "Demo", null, "healthy", DateTimeOffset.Parse("2026-08-20T10:00:10.000Z"));

    private static HttpResponseMessage JsonResponse(HttpStatusCode statusCode, string json) => new(statusCode)
    {
        Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
    };

    private sealed class RecordingHandler(params HttpResponseMessage[] responses) : HttpMessageHandler
    {
        private int _index;
        public List<HttpRequestMessage> Requests { get; } = [];
        public List<string> RequestBodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            RequestBodies.Add(request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken));
            var response = responses[Math.Min(_index, responses.Length - 1)];
            _index += 1;
            return response;
        }
    }

    private sealed class FakeReader(IReadOnlyList<TallyStockItem> items) : ITallyInventoryReader
    {
        public Task<IReadOnlyList<TallyStockItem>> ReadInventoryAsync(CancellationToken cancellationToken) => Task.FromResult(items);
        public Task<DiagnosticReport> RunDiagnosticAsync(DiagnosticOptions options, CancellationToken cancellationToken) => Task.FromResult(new DiagnosticReport { Succeeded = true });
    }
}
