using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace Imply.TallyConnector.Tests;

public sealed class CliAndDiagnosticTests
{
    [Fact]
    public void HelpCommandParsesWithoutRunMode()
    {
        var cli = CliOptions.Parse(["--help"]);

        Assert.Equal(ConnectorCommand.Help, cli.Command);
        Assert.False(cli.Upload);
    }

    [Fact]
    public void UnknownCommandReturnsUnknown()
    {
        var cli = CliOptions.Parse(["start"]);

        Assert.Equal(ConnectorCommand.Unknown, cli.Command);
        Assert.Equal("start", cli.UnknownCommand);
    }

    [Fact]
    public void BlankCloudApiUrlIsClearRunConfigurationError()
    {
        var errors = ConnectorConfigurationValidator.ValidateForRun(new ConnectorOptions
        {
            CloudApiBaseUrl = "",
            ConnectorId = "office-main"
        });

        Assert.Contains("Connector:CloudApiBaseUrl is required in run mode.", errors);
    }

    [Fact]
    public async Task DiagnosticWithoutUploadDoesNotInvokeCloud()
    {
        var reader = new FakeReader(new DiagnosticReport
        {
            TallyEndpoint = "http://localhost:9000",
            TallyReachable = true,
            HttpStatusCode = 200,
            Succeeded = true,
            ParsedItemCount = 1
        });
        var cloud = new RecordingCloudApiClient();
        var runner = new DiagnosticRunner(reader, cloud, Options.Create(new ConnectorOptions()));

        var exitCode = await runner.RunAsync(upload: false, saveResponse: false, CancellationToken.None);

        Assert.Equal(0, exitCode);
        Assert.Equal(0, cloud.SnapshotCalls);
        Assert.Equal(0, cloud.HeartbeatCalls);
    }

    [Fact]
    public async Task DiagnosticSaveResponseDoesNotUpload()
    {
        var reader = new FakeReader(new DiagnosticReport
        {
            TallyEndpoint = "http://localhost:9000",
            TallyReachable = true,
            HttpStatusCode = 200,
            Succeeded = true,
            ParsedItemCount = 1,
            SavedResponsePath = Path.Combine("diagnostics", "tally-response.xml")
        });
        var cloud = new RecordingCloudApiClient();
        var runner = new DiagnosticRunner(reader, cloud, Options.Create(new ConnectorOptions()));

        var exitCode = await runner.RunAsync(upload: false, saveResponse: true, CancellationToken.None);

        Assert.Equal(0, exitCode);
        Assert.Equal(0, cloud.SnapshotCalls);
        Assert.Equal(0, cloud.HeartbeatCalls);
    }

    [Fact]
    public async Task HeartbeatNetworkFailureDoesNotCrashWorker()
    {
        var reader = new FakeReader(new DiagnosticReport { Succeeded = true }, [new TallyStockItem("IMPLY ROYAL", 1, "sheets", [])]);
        var cloud = new RecordingCloudApiClient { ThrowHeartbeat = true };
        var worker = new ConnectorWorker(
            reader,
            cloud,
            Options.Create(new ConnectorOptions { CloudApiBaseUrl = "https://stock.imply.co.in", ConnectorId = "office-main", TallyCompanyName = "Demo" }),
            NullLogger<ConnectorWorker>.Instance);

        await worker.SyncOnceAsync(CancellationToken.None);

        Assert.Equal(1, cloud.SnapshotCalls);
        Assert.Equal(4, cloud.HeartbeatCalls);
    }

    [Fact]
    public void DiagnosticInspectionDoesNotExposeSecretText()
    {
        var inspection = TallyXmlParser.Inspect("<ENVELOPE><STATUS>OK</STATUS></ENVELOPE>");

        Assert.DoesNotContain("IMPLY_CONNECTOR_SECRET", inspection.SanitizedPreview);
    }

    private sealed class FakeReader(DiagnosticReport report, IReadOnlyList<TallyStockItem>? items = null) : ITallyInventoryReader
    {
        public Task<IReadOnlyList<TallyStockItem>> ReadInventoryAsync(CancellationToken cancellationToken) => Task.FromResult(items ?? [new TallyStockItem("IMPLY ROYAL", 1, "sheets", [])]);

        public Task<DiagnosticReport> RunDiagnosticAsync(DiagnosticOptions options, CancellationToken cancellationToken) => Task.FromResult(report);
    }

    private sealed class RecordingCloudApiClient : ICloudApiClient
    {
        public int SnapshotCalls { get; private set; }
        public int HeartbeatCalls { get; private set; }
        public bool ThrowHeartbeat { get; init; }

        public Task SendSnapshotAsync(InventorySnapshot snapshot, CancellationToken cancellationToken)
        {
            SnapshotCalls += 1;
            return Task.CompletedTask;
        }

        public Task SendHeartbeatAsync(Heartbeat heartbeat, CancellationToken cancellationToken)
        {
            HeartbeatCalls += 1;
            return ThrowHeartbeat ? throw new HttpRequestException("Simulated heartbeat failure") : Task.CompletedTask;
        }
    }
}
