using System.Xml.Linq;
using System.Text.RegularExpressions;

namespace Imply.TallyConnector;

public static partial class TallyXmlParser
{
    public static IReadOnlyList<TallyStockItem> ParseStockItems(string xml)
    {
        var document = XDocument.Parse(SanitizeXml(xml));
        if (IsCmpInfoOnlyProcessingResponse(document))
        {
            throw new TallyExtractionException("Tally returned a CMPINFO processing summary instead of inventory export data.", "processing_response");
        }

        var statusText = FindStatusText(document);
        if (!string.IsNullOrWhiteSpace(statusText) && statusText.Contains("error", StringComparison.OrdinalIgnoreCase))
        {
            throw new TallyExtractionException($"Tally returned an error response: {statusText}", "tally_error");
        }

        var stockElements = document.Descendants()
            .Where(element =>
                (element.Name.LocalName.Equals("STOCKITEM", StringComparison.OrdinalIgnoreCase) ||
                element.Name.LocalName.Equals("IMPLYSTOCKITEM", StringComparison.OrdinalIgnoreCase)) &&
                !element.Ancestors().Any(a => a.Name.LocalName.Equals("CMPINFO", StringComparison.OrdinalIgnoreCase)))
            .ToList();
        if (stockElements.Count == 0)
        {
            if (HasInventoryCollection(document)) return [];
            throw new TallyExtractionException("Tally XML response did not contain inventory export data.", "malformed_response");
        }

        return stockElements
            .Select(ParseItem)
            .Where(item => !string.IsNullOrWhiteSpace(item.TallyItemName))
            .ToList();
    }

    private static TallyStockItem ParseItem(XElement element)
    {
        var name = (string?)element.Attribute("NAME") ?? FirstValue(element, "NAME", "STOCKITEMNAME", "DSPDISPNAME") ?? "";
        var unit = FirstValue(element, "BASEUNITS", "UNIT", "CLOSINGUOM") ?? ParseUnit(FirstValue(element, "CLOSINGBALANCE", "CLOSINGQTY")) ?? "units";
        var closing = FirstValue(element, "CLOSINGBALANCE", "CLOSINGQTY");
        var godowns = element.Descendants()
            .Where(e =>
                e.Name.LocalName.Equals("GODOWNALLOCATIONS.LIST", StringComparison.OrdinalIgnoreCase) ||
                e.Name.LocalName.Equals("BATCHALLOCATIONS.LIST", StringComparison.OrdinalIgnoreCase) ||
                e.Name.LocalName.Equals("GODOWN", StringComparison.OrdinalIgnoreCase))
            .Select(g => new GodownQuantity(
                FirstValue(g, "GODOWNNAME", "NAME") ?? "Unspecified",
                TallyJsonParser.ParseDecimal(FirstValue(g, "CLOSINGBALANCE", "CLOSINGQTY", "QUANTITY"))))
            .ToList();
        return new TallyStockItem(name, TallyJsonParser.ParseDecimal(closing), unit, godowns);
    }

    public static TallyParseInspection Inspect(string xml)
    {
        try
        {
            var document = XDocument.Parse(SanitizeXml(xml));
            var names = document.Descendants().Select(e => e.Name.LocalName).Distinct(StringComparer.OrdinalIgnoreCase).Take(30).ToList();
            var kind = IsCmpInfoOnlyProcessingResponse(document)
                ? "processing_response"
                : HasInventoryRecords(document)
                    ? "inventory_records"
                    : HasInventoryCollection(document)
                        ? "empty_inventory"
                        : "malformed_response";
            return new TallyParseInspection("xml", kind, names, FindStatusText(document), TallyJsonParser.SanitizePreview(xml));
        }
        catch (Exception ex) when (ex is System.Xml.XmlException or InvalidOperationException)
        {
            return new TallyParseInspection("unknown", "malformed_response", [], ex.Message, TallyJsonParser.SanitizePreview(xml));
        }
    }

    private static string? FirstValue(XElement element, params string[] localNames) =>
        element.DescendantsAndSelf()
            .FirstOrDefault(e => localNames.Any(name => e.Name.LocalName.Equals(name, StringComparison.OrdinalIgnoreCase)))
            ?.Value
            ?.Trim();

    private static string? FindStatusText(XDocument document)
    {
        var statusElement = document.Descendants().FirstOrDefault(e =>
            e.Name.LocalName.Contains("ERROR", StringComparison.OrdinalIgnoreCase) ||
            e.Name.LocalName.Contains("STATUS", StringComparison.OrdinalIgnoreCase) ||
            e.Name.LocalName.Contains("LINEERROR", StringComparison.OrdinalIgnoreCase));
        return statusElement?.Value.Trim();
    }

    private static bool IsCmpInfoOnlyProcessingResponse(XDocument document)
    {
        var stockItems = document.Descendants().Where(e => e.Name.LocalName.Equals("STOCKITEM", StringComparison.OrdinalIgnoreCase)).ToList();
        return !HasInventoryCollection(document) && stockItems.Count > 0 && stockItems.All(e =>
            e.Ancestors().Any(a => a.Name.LocalName.Equals("CMPINFO", StringComparison.OrdinalIgnoreCase)) &&
            e.Ancestors().Any(a => a.Name.LocalName.Equals("DESC", StringComparison.OrdinalIgnoreCase)));
    }

    private static bool HasInventoryCollection(XDocument document) =>
        document.Descendants().Any(e =>
            e.Name.LocalName.Equals("COLLECTION", StringComparison.OrdinalIgnoreCase) &&
            e.Ancestors().Any(a => a.Name.LocalName.Equals("DATA", StringComparison.OrdinalIgnoreCase)));

    private static bool HasInventoryRecords(XDocument document) =>
        document.Descendants().Any(e =>
            e.Name.LocalName.Equals("STOCKITEM", StringComparison.OrdinalIgnoreCase) && !e.Ancestors().Any(a => a.Name.LocalName.Equals("CMPINFO", StringComparison.OrdinalIgnoreCase)) ||
            e.Name.LocalName.Equals("IMPLYSTOCKITEM", StringComparison.OrdinalIgnoreCase));

    private static string? ParseUnit(string? quantity)
    {
        if (string.IsNullOrWhiteSpace(quantity)) return null;
        var parts = quantity.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 1 ? string.Join(' ', parts.Skip(1)) : null;
    }

    public static string RemoveInvalidXmlCharacters(string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        value = RemoveInvalidXmlNumericReferences(value);
        var cleaned = new char[value.Length];
        var writeIndex = 0;
        foreach (var ch in value)
        {
            if (IsAllowedXml10Character(ch))
            {
                cleaned[writeIndex] = ch;
                writeIndex += 1;
            }
        }
        return writeIndex == value.Length ? value : new string(cleaned, 0, writeIndex);
    }

    public static int CountInvalidXmlCharacters(string value) =>
        string.IsNullOrEmpty(value)
            ? 0
            : CountInvalidXmlNumericReferences(value) + RemoveInvalidXmlNumericReferences(value).Count(ch => !IsAllowedXml10Character(ch));

    public static string SanitizeXml(string value) => RemoveInvalidXmlCharacters(value);

    private static bool IsAllowedXml10Character(char ch) =>
        ch is '\u0009' or '\u000A' or '\u000D' || ch >= '\u0020';

    private static string RemoveInvalidXmlNumericReferences(string value) =>
        InvalidXmlNumericReferenceRegex().Replace(value, match =>
        {
            var raw = match.Groups["hex"].Success ? match.Groups["hex"].Value : match.Groups["decimal"].Value;
            var codePoint = match.Groups["hex"].Success
                ? Convert.ToInt32(raw, 16)
                : Convert.ToInt32(raw, 10);
            return IsAllowedXml10CodePoint(codePoint) ? match.Value : "";
        });

    private static int CountInvalidXmlNumericReferences(string value) =>
        InvalidXmlNumericReferenceRegex()
            .Matches(value)
            .Count(match =>
            {
                var raw = match.Groups["hex"].Success ? match.Groups["hex"].Value : match.Groups["decimal"].Value;
                var codePoint = match.Groups["hex"].Success
                    ? Convert.ToInt32(raw, 16)
                    : Convert.ToInt32(raw, 10);
                return !IsAllowedXml10CodePoint(codePoint);
            });

    private static bool IsAllowedXml10CodePoint(int codePoint) =>
        codePoint is 0x9 or 0xA or 0xD ||
        codePoint is >= 0x20 and <= 0xD7FF ||
        codePoint is >= 0xE000 and <= 0xFFFD ||
        codePoint is >= 0x10000 and <= 0x10FFFF;

    [GeneratedRegex(@"&#(?:x(?<hex>[0-9a-fA-F]+)|(?<decimal>[0-9]+));", RegexOptions.CultureInvariant)]
    private static partial Regex InvalidXmlNumericReferenceRegex();
}
