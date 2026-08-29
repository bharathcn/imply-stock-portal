using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Imply.TallyConnector;

public sealed class JsonTallyInventoryReader(TallyHttpClient tally, XmlTallyInventoryReader xmlFallback, IOptions<ConnectorOptions> options, ILogger<JsonTallyInventoryReader> logger) : ITallyInventoryReader
{
    private readonly ConnectorOptions _options = options.Value;

    public async Task<IReadOnlyList<TallyStockItem>> ReadInventoryAsync(CancellationToken cancellationToken)
    {
        if (!_options.PreferJson) return await xmlFallback.ReadInventoryAsync(cancellationToken);

        try
        {
            var response = await tally.PostAsync(JsonRequests.StockSummary(_options.TallyCompanyName), "application/json", cancellationToken);
            if (response.StatusCode is < 200 or > 299) throw new HttpRequestException($"Tally JSON request returned HTTP {response.StatusCode}.");
            var items = TallyJsonParser.ParseStockItems(response.Body);
            if (items.Count == 0) throw new TallyExtractionException("Tally JSON response contained an empty inventory collection.", "empty_inventory");
            return items;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "JSON inventory extraction failed. Falling back to XML.");
            return await xmlFallback.ReadInventoryAsync(cancellationToken);
        }
    }

    public async Task<DiagnosticReport> RunDiagnosticAsync(DiagnosticOptions diagnosticOptions, CancellationToken cancellationToken)
    {
        var report = new DiagnosticReport
        {
            TallyEndpoint = _options.TallyLocalUrl,
            CompanyConfigured = !string.IsNullOrWhiteSpace(_options.TallyCompanyName)
        };

        if (!_options.PreferJson)
        {
            var xmlPrimary = await xmlFallback.RunDiagnosticAsync(diagnosticOptions, cancellationToken);
            xmlPrimary.ReaderUsed = "xml";
            return xmlPrimary;
        }

        try
        {
            var response = await tally.PostAsync(JsonRequests.StockSummary(_options.TallyCompanyName), "application/json", cancellationToken);
            report.TallyReachable = true;
            report.HttpStatusCode = response.StatusCode;
            report.ResponseContentType = response.ContentType;
            report.OutgoingRequestPropertyNames = JsonRequests.GetTopLevelPropertyNames(response.RequestBody);
            var inspection = TallyJsonParser.Inspect(response.Body);
            report.DetectedResponseFormat = inspection.Format;
            report.ResponseKind = inspection.Kind;
            report.JsonResponseKind = inspection.Kind;
            report.ReaderUsed = "json";
            report.RootNames = inspection.RootNames;
            report.TallyStatusText = inspection.TallyStatusText;
            report.SanitizedPreview = inspection.SanitizedPreview;
            if (diagnosticOptions.SaveResponse) report.SavedResponsePath = DiagnosticResponseWriter.Save("json", response.Body);

            if (response.StatusCode is < 200 or > 299) throw new HttpRequestException($"Tally JSON request returned HTTP {response.StatusCode}.");
            var items = TallyJsonParser.ParseStockItems(response.Body);
            if (items.Count == 0) throw new TallyExtractionException("Tally JSON response contained an empty inventory collection.", "empty_inventory");

            FillInventoryDiagnostics(report, items, true);
            return report;
        }
        catch (Exception jsonEx)
        {
            report.Error = jsonEx.Message;
            report.JsonError = jsonEx.Message;
            try
            {
                var fallback = await xmlFallback.RunDiagnosticAsync(diagnosticOptions, cancellationToken);
                fallback.ReaderUsed = "xml fallback";
                fallback.JsonError = jsonEx.Message;
                fallback.JsonResponseKind = report.ResponseKind;
                fallback.OutgoingRequestPropertyNames = report.OutgoingRequestPropertyNames;
                if (!fallback.Succeeded)
                {
                    fallback.XmlError = fallback.Error;
                    fallback.Error = $"JSON failed: {jsonEx.Message}; XML failed: {fallback.XmlError}";
                }
                return fallback;
            }
            catch (Exception xmlEx)
            {
                report.XmlError = xmlEx.Message;
                report.Error = $"JSON failed: {jsonEx.Message}; XML failed: {xmlEx.Message}";
                return report;
            }
        }
    }

    private static void FillInventoryDiagnostics(DiagnosticReport report, IReadOnlyList<TallyStockItem> items, bool companyAppearsLoaded)
    {
        report.CompanyAppearsLoaded = companyAppearsLoaded;
        report.ParsedItemCount = items.Count;
        report.SampleItemCount = Math.Min(items.Count, 5);
        report.SampleItemNames = items.Take(5).Select(item => item.TallyItemName).ToList();
        report.QuantitiesParsed = items.Any(item => item.TotalQuantity != 0) || items.Any(item => item.TotalQuantity == 0);
        report.GodownAllocationsParsed = items.Any(item => item.Godowns.Count > 0);
        report.Succeeded = report.TallyReachable && items.Count > 0;
    }
}

public static class DiagnosticResponseWriter
{
    public static string Save(string extension, string body)
    {
        var directory = Path.Combine(Directory.GetCurrentDirectory(), "diagnostics");
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, $"tally-response-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}.{extension}");
        File.WriteAllText(path, body);
        return path;
    }
}

public static class TallyDiagnosticExtensions
{
    public static void FillInventoryDiagnostics(this DiagnosticReport report, IReadOnlyList<TallyStockItem> items)
    {
        report.CompanyAppearsLoaded = items.Count > 0;
        report.ParsedItemCount = items.Count;
        report.SampleItemCount = Math.Min(items.Count, 5);
        report.SampleItemNames = items.Take(5).Select(item => item.TallyItemName).ToList();
        report.QuantitiesParsed = items.Count > 0;
        report.GodownAllocationsParsed = items.Any(item => item.Godowns.Count > 0);
        report.Succeeded = report.TallyReachable && items.Count > 0;
    }
}

public static class DiagnosticReportFactory
{
    public static DiagnosticReport Failed(ConnectorOptions options, Exception ex) =>
        new()
        {
            TallyEndpoint = options.TallyLocalUrl,
            TallyReachable = false,
            CompanyConfigured = !string.IsNullOrWhiteSpace(options.TallyCompanyName),
            Error = ex.Message,
            Succeeded = false
        };
}

public static class JsonRequests
{
    public static string StockSummary(string companyName) => JsonSerializer.Serialize(new TallyJsonExportRequest(
        Version: 1,
        TallyRequest: "Export",
        Type: "Collection",
        Id: "IMPLYStockItems",
        Desc: new TallyJsonExportDesc(
            StaticVariables: new TallyJsonStaticVariables(companyName),
            FetchList: ["Name", "BaseUnits", "ClosingBalance", "GodownAllocations.GodownName", "GodownAllocations.ClosingBalance"])));

    public static IReadOnlyList<string> GetTopLevelPropertyNames(string requestBody)
    {
        using var document = JsonDocument.Parse(requestBody);
        return document.RootElement.ValueKind == JsonValueKind.Object
            ? document.RootElement.EnumerateObject().Select(property => property.Name).ToList()
            : [];
    }
}

public sealed record TallyJsonExportRequest(
    [property: JsonPropertyName("version")] int Version,
    [property: JsonPropertyName("tallyrequest")] string TallyRequest,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("desc")] TallyJsonExportDesc Desc);

public sealed record TallyJsonExportDesc(
    [property: JsonPropertyName("staticvariables")] TallyJsonStaticVariables StaticVariables,
    [property: JsonPropertyName("fetchlist")] IReadOnlyList<string> FetchList);

public sealed record TallyJsonStaticVariables(
    [property: JsonPropertyName("svcurrentcompany")] string SvCurrentCompany);
