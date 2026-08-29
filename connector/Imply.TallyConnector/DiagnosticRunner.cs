using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Imply.TallyConnector;

public sealed class DiagnosticRunner(ITallyInventoryReader reader, ICloudApiClient cloud, IOptions<ConnectorOptions> options)
{
    private readonly ConnectorOptions _options = options.Value;

    public async Task<int> RunAsync(bool upload, bool saveResponse, CancellationToken cancellationToken)
    {
        var report = await reader.RunDiagnosticAsync(new DiagnosticOptions(saveResponse), cancellationToken);
        Console.WriteLine(JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }));
        if (report.SavedResponsePath is not null)
        {
            Console.Error.WriteLine($"Raw Tally response saved to: {report.SavedResponsePath}");
            Console.Error.WriteLine("Warning: the saved diagnostic response may contain business inventory data. Do not commit or upload it.");
        }

        if (!report.Succeeded) return 1;
        if (!upload) return 0;

        var errors = ConnectorConfigurationValidator.ValidateForDiagnosticUpload(_options);
        if (errors.Count > 0)
        {
            foreach (var error in errors) Console.Error.WriteLine($"Configuration error: {error}");
            return 1;
        }

        var items = await reader.ReadInventoryAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        await cloud.SendSnapshotAsync(new InventorySnapshot(_options.ConnectorId, Guid.NewGuid(), _options.TallyCompanyName, now, DateTimeOffset.UtcNow, "0.1.0", report.TallyRelease, items), cancellationToken);
        Console.WriteLine("Diagnostic upload completed.");
        return 0;
    }
}
