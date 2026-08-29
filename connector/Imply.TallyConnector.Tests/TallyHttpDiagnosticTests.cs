using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Imply.TallyConnector.Tests;

public sealed class TallyHttpDiagnosticTests
{
    [Fact]
    public async Task FinalJsonHttpBodyContainsExactLowercaseTallyrequest()
    {
        var handler = new RecordingHandler([
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"status":0,"error_list":"Invalid Request Format, Missing tallyrequest"}""")
            }
        ]);
        var client = new TallyHttpClient(new HttpClient(handler), Options.Create(new ConnectorOptions { TallyLocalUrl = "http://localhost:9000" }));

        var response = await client.PostAsync(JsonRequests.StockSummary("Demo Company"), "application/json", CancellationToken.None);

        Assert.Contains("\"tallyrequest\"", response.RequestBody);
        Assert.DoesNotContain("\"TallyRequest\"", response.RequestBody);
        Assert.DoesNotContain("\"tallyRequest\"", response.RequestBody);
        Assert.Contains("tallyrequest", JsonRequests.GetTopLevelPropertyNames(response.RequestBody));
        Assert.Equal(response.RequestBody, handler.RequestBodies.Single());
    }

    [Fact]
    public async Task JsonRequestRejectedDiagnosticInvokesXmlFallbackAndReturnsInventory()
    {
        var handler = new RecordingHandler([
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"status":0,"error_list":"Invalid Request Format, Missing tallyrequest"}""", System.Text.Encoding.UTF8, "application/json")
            },
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(SuccessfulXmlExport, System.Text.Encoding.UTF8, "application/xml")
            }
        ]);
        var options = Options.Create(new ConnectorOptions
        {
            TallyLocalUrl = "http://localhost:9000",
            TallyCompanyName = "Demo Company",
            PreferJson = true
        });
        var tally = new TallyHttpClient(new HttpClient(handler), options);
        var xml = new XmlTallyInventoryReader(tally, options);
        var json = new JsonTallyInventoryReader(tally, xml, options, NullLogger<JsonTallyInventoryReader>.Instance);

        var report = await json.RunDiagnosticAsync(new DiagnosticOptions(SaveResponse: false), CancellationToken.None);

        Assert.True(report.Succeeded, report.Error);
        Assert.Equal("xml fallback", report.ReaderUsed);
        Assert.Equal("request_rejected", report.JsonResponseKind);
        Assert.Equal("inventory_records", report.XmlResponseKind);
        Assert.Contains("Invalid Request Format, Missing tallyrequest", report.JsonError);
        Assert.Equal(2, handler.RequestBodies.Count);
        Assert.Contains("\"tallyrequest\"", handler.RequestBodies[0]);
        Assert.Contains("<TALLYREQUEST>Export Data</TALLYREQUEST>", handler.RequestBodies[1]);
        Assert.Contains("<NATIVEMETHOD>Name</NATIVEMETHOD>", handler.RequestBodies[1]);
        Assert.Equal("text/xml; charset=utf-8", handler.ContentTypes[1]);
    }

    [Fact]
    public async Task XmlDiagnosticCapturesSafeOutgoingRequestMetadata()
    {
        var handler = new RecordingHandler([
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(SuccessfulXmlExport, System.Text.Encoding.UTF8, "text/xml")
            }
        ]);
        var options = Options.Create(new ConnectorOptions
        {
            TallyLocalUrl = "http://localhost:9000",
            TallyCompanyName = "Demo Company",
            PreferJson = false
        });
        var tally = new TallyHttpClient(new HttpClient(handler), options);
        var xml = new XmlTallyInventoryReader(tally, options);

        var report = await xml.RunDiagnosticAsync(new DiagnosticOptions(SaveResponse: false), CancellationToken.None);

        Assert.True(report.Succeeded, report.Error);
        Assert.Equal("Export Data/Collection/IMPLYStockItems", report.OutgoingRequestKind);
        Assert.Contains("TALLYREQUEST", report.OutgoingRequestElementNames);
        Assert.Contains("NATIVEMETHOD", report.OutgoingRequestElementNames);
        Assert.DoesNotContain("LEDGER", report.OutgoingRequestElementNames);
        Assert.DoesNotContain("VOUCHER", report.OutgoingRequestElementNames);
    }

    [Fact]
    public async Task DiagnosticWithoutUploadStillDoesNotCallCloudWhenXmlFallbackSucceeds()
    {
        var reader = new FakeReader(new DiagnosticReport
        {
            Succeeded = true,
            ReaderUsed = "xml fallback",
            ParsedItemCount = 1
        });
        var cloud = new RecordingCloudApiClient();
        var runner = new DiagnosticRunner(reader, cloud, Options.Create(new ConnectorOptions()));

        var exitCode = await runner.RunAsync(upload: false, saveResponse: false, CancellationToken.None);

        Assert.Equal(0, exitCode);
        Assert.Equal(0, cloud.SnapshotCalls);
        Assert.Equal(0, cloud.HeartbeatCalls);
    }

    private const string SuccessfulXmlExport = """
    <ENVELOPE>
      <BODY>
        <DATA>
          <COLLECTION NAME="IMPLYStockItems">
            <STOCKITEM NAME="IMPLY ROYAL 18MM 8×4 BWP">
              <BASEUNITS>sheets</BASEUNITS>
              <CLOSINGBALANCE>42.50 sheets</CLOSINGBALANCE>
              <GODOWNALLOCATIONS.LIST>
                <GODOWNNAME>RR Nagar</GODOWNNAME>
                <CLOSINGBALANCE>30.25 sheets</CLOSINGBALANCE>
              </GODOWNALLOCATIONS.LIST>
              <GODOWNALLOCATIONS.LIST>
                <GODOWNNAME>Main</GODOWNNAME>
                <CLOSINGBALANCE>12.25 sheets</CLOSINGBALANCE>
              </GODOWNALLOCATIONS.LIST>
            </STOCKITEM>
          </COLLECTION>
        </DATA>
      </BODY>
    </ENVELOPE>
    """;

    private sealed class RecordingHandler(Queue<HttpResponseMessage> responses) : HttpMessageHandler
    {
        public List<string> RequestBodies { get; } = [];
        public List<string?> ContentTypes { get; } = [];

        public RecordingHandler(IEnumerable<HttpResponseMessage> responses) : this(new Queue<HttpResponseMessage>(responses))
        {
        }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestBodies.Add(request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken));
            ContentTypes.Add(request.Content?.Headers.ContentType?.ToString());
            return responses.Dequeue();
        }
    }

    private sealed class FakeReader(DiagnosticReport report) : ITallyInventoryReader
    {
        public Task<IReadOnlyList<TallyStockItem>> ReadInventoryAsync(CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<TallyStockItem>>([new TallyStockItem("IMPLY ROYAL", 1, "sheets", [])]);

        public Task<DiagnosticReport> RunDiagnosticAsync(DiagnosticOptions options, CancellationToken cancellationToken) => Task.FromResult(report);
    }

    private sealed class RecordingCloudApiClient : ICloudApiClient
    {
        public int SnapshotCalls { get; private set; }
        public int HeartbeatCalls { get; private set; }

        public Task SendSnapshotAsync(InventorySnapshot snapshot, CancellationToken cancellationToken)
        {
            SnapshotCalls += 1;
            return Task.CompletedTask;
        }

        public Task SendHeartbeatAsync(Heartbeat heartbeat, CancellationToken cancellationToken)
        {
            HeartbeatCalls += 1;
            return Task.CompletedTask;
        }
    }
}
