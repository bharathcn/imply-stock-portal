using Microsoft.Extensions.Options;

namespace Imply.TallyConnector;

public sealed class XmlTallyInventoryReader(TallyHttpClient tally, IOptions<ConnectorOptions> options) : ITallyInventoryReader
{
    private readonly ConnectorOptions _options = options.Value;

    public async Task<IReadOnlyList<TallyStockItem>> ReadInventoryAsync(CancellationToken cancellationToken)
    {
        var response = await tally.PostAsync(XmlRequests.StockSummary(_options.TallyCompanyName), "text/xml", cancellationToken);
        if (response.StatusCode is < 200 or > 299) throw new HttpRequestException($"Tally XML request returned HTTP {response.StatusCode}.");
        var items = TallyXmlParser.ParseStockItems(response.Body);
        if (items.Count == 0) throw new TallyExtractionException("Tally XML response contained an empty inventory collection.", "empty_inventory");
        return items;
    }

    public async Task<DiagnosticReport> RunDiagnosticAsync(DiagnosticOptions diagnosticOptions, CancellationToken cancellationToken)
    {
        var report = new DiagnosticReport
        {
            TallyEndpoint = _options.TallyLocalUrl,
            CompanyConfigured = !string.IsNullOrWhiteSpace(_options.TallyCompanyName),
            ReaderUsed = "xml"
        };
        try
        {
            var response = await tally.PostAsync(XmlRequests.StockSummary(_options.TallyCompanyName), "text/xml", cancellationToken);
            report.TallyReachable = true;
            report.HttpStatusCode = response.StatusCode;
            report.ResponseContentType = response.ContentType;
            report.OutgoingRequestKind = XmlRequests.GetRequestKind(response.RequestBody);
            report.OutgoingRequestElementNames = XmlRequests.GetElementNames(response.RequestBody);
            report.RemovedInvalidXmlCharacterCount = TallyXmlParser.CountInvalidXmlCharacters(response.Body);
            var inspection = TallyXmlParser.Inspect(response.Body);
            report.DetectedResponseFormat = inspection.Format;
            report.ResponseKind = inspection.Kind;
            report.XmlResponseKind = inspection.Kind;
            report.RootNames = inspection.RootNames;
            report.TallyStatusText = inspection.TallyStatusText;
            report.SanitizedPreview = inspection.SanitizedPreview;
            if (diagnosticOptions.SaveResponse) report.SavedResponsePath = DiagnosticResponseWriter.Save("xml", response.Body);
            if (response.StatusCode is < 200 or > 299) throw new HttpRequestException($"Tally XML request returned HTTP {response.StatusCode}.");

            var items = TallyXmlParser.ParseStockItems(response.Body);
            if (items.Count == 0) throw new TallyExtractionException("Tally XML response contained an empty inventory collection.", "empty_inventory");
            report.FillInventoryDiagnostics(items);
            return report;
        }
        catch (Exception ex)
        {
            report.Error = ex.Message;
            report.XmlError = ex.Message;
            return report;
        }
    }
}

public static class XmlRequests
{
    public static string StockSummary(string companyName) =>
        $"""
        <ENVELOPE>
          <HEADER>
            <VERSION>1</VERSION>
            <TALLYREQUEST>Export</TALLYREQUEST>
            <TYPE>Collection</TYPE>
            <ID>IMPLYStockItems</ID>
          </HEADER>
          <BODY>
            <DESC>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>{System.Security.SecurityElement.Escape(companyName)}</SVCURRENTCOMPANY>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
              </STATICVARIABLES>
              <TDL>
                <TDLMESSAGE>
                  <COLLECTION NAME="IMPLYStockItems" ISMODIFY="No" ISINITIALIZE="Yes">
                    <TYPE>Stock Item</TYPE>
                    <NATIVEMETHOD>Name</NATIVEMETHOD>
                    <NATIVEMETHOD>BaseUnits</NATIVEMETHOD>
                    <NATIVEMETHOD>ClosingBalance</NATIVEMETHOD>
                    <NATIVEMETHOD>GodownAllocations.*</NATIVEMETHOD>
                    <NATIVEMETHOD>BatchAllocations.*</NATIVEMETHOD>
                  </COLLECTION>
                </TDLMESSAGE>
              </TDL>
            </DESC>
          </BODY>
        </ENVELOPE>
        """;

    public static IReadOnlyList<string> GetElementNames(string requestBody)
    {
        try
        {
            var document = System.Xml.Linq.XDocument.Parse(requestBody);
            return document.Descendants().Select(e => e.Name.LocalName).Take(40).ToList();
        }
        catch
        {
            return [];
        }
    }

    public static string? GetRequestKind(string requestBody)
    {
        try
        {
            var document = System.Xml.Linq.XDocument.Parse(requestBody);
            var tallyRequest = document.Descendants().FirstOrDefault(e => e.Name.LocalName.Equals("TALLYREQUEST", StringComparison.OrdinalIgnoreCase))?.Value.Trim();
            var type = document.Descendants().FirstOrDefault(e => e.Name.LocalName.Equals("TYPE", StringComparison.OrdinalIgnoreCase))?.Value.Trim();
            var id = document.Descendants().FirstOrDefault(e => e.Name.LocalName.Equals("ID", StringComparison.OrdinalIgnoreCase))?.Value.Trim();
            return $"{tallyRequest}/{type}/{id}";
        }
        catch
        {
            return null;
        }
    }
}
