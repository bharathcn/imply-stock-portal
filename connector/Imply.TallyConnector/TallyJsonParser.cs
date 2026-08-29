using System.Text.Json;

namespace Imply.TallyConnector;

public static class TallyJsonParser
{
    public static IReadOnlyList<TallyStockItem> ParseStockItems(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var statusText = FindStatusText(root);
        if (IsRejected(root, statusText))
        {
            throw new TallyExtractionException($"Tally rejected the JSON request: {statusText}", "request_rejected");
        }

        var itemArray = root.TryGetProperty("items", out var items) ? items : root.TryGetProperty("stockItems", out var stockItems) ? stockItems : default;
        if (itemArray.ValueKind != JsonValueKind.Array) throw new TallyExtractionException("Tally JSON response did not contain an inventory item array.", "malformed_response");

        return itemArray.EnumerateArray()
            .Select(ParseItem)
            .Where(item => !string.IsNullOrWhiteSpace(item.TallyItemName))
            .ToList();
    }

    private static TallyStockItem ParseItem(JsonElement item)
    {
        var name = GetString(item, "name", "tallyItemName", "stockItemName");
        var unit = GetString(item, "unit", "baseUnit") ?? "units";
        var total = ParseDecimal(GetString(item, "closingBalance", "totalQuantity", "quantity"));
        var godowns = new List<GodownQuantity>();
        if (item.TryGetProperty("godowns", out var godownArray) && godownArray.ValueKind == JsonValueKind.Array)
        {
            godowns.AddRange(godownArray.EnumerateArray().Select(g => new GodownQuantity(
                GetString(g, "name", "godownName") ?? "Unspecified",
                ParseDecimal(GetString(g, "quantity", "closingBalance")))));
        }
        return new TallyStockItem(name ?? "", total, unit, godowns);
    }

    private static string? GetString(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (element.TryGetProperty(name, out var value)) return value.ToString();
        }
        return null;
    }

    public static decimal ParseDecimal(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return 0;
        var numeric = new string(value.Trim().TakeWhile(ch => char.IsDigit(ch) || ch == '.' || ch == '-' || ch == '+').ToArray());
        return decimal.TryParse(numeric, out var result) ? result : 0;
    }

    public static TallyParseInspection Inspect(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            var names = root.ValueKind == JsonValueKind.Object ? root.EnumerateObject().Select(p => p.Name).Take(20).ToList() : [root.ValueKind.ToString()];
            var statusText = FindStatusText(root);
            var kind = IsRejected(root, statusText) ? "request_rejected" : root.TryGetProperty("items", out _) || root.TryGetProperty("stockItems", out _) ? "inventory_records" : "malformed_response";
            return new TallyParseInspection("json", kind, names, statusText, SanitizePreview(json));
        }
        catch (JsonException ex)
        {
            return new TallyParseInspection("unknown", "malformed_response", [], ex.Message, SanitizePreview(json));
        }
    }

    private static string? FindStatusText(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            if (element.TryGetProperty("error_list", out var errorList)) return errorList.ToString();
            if (element.TryGetProperty("error", out var error)) return error.ToString();
            if (element.TryGetProperty("message", out var message)) return message.ToString();
            if (element.TryGetProperty("status", out var status)) return $"status: {status}";
            foreach (var property in element.EnumerateObject())
            {
                if (property.Name.Contains("error", StringComparison.OrdinalIgnoreCase) ||
                    property.Name.Contains("status", StringComparison.OrdinalIgnoreCase) ||
                    property.Name.Contains("message", StringComparison.OrdinalIgnoreCase))
                {
                    return property.Value.ToString();
                }
            }
        }
        return null;
    }

    private static bool IsRejected(JsonElement root, string? statusText)
    {
        if (root.ValueKind != JsonValueKind.Object) return false;
        var hasErrorList = root.TryGetProperty("error_list", out var errorList) && !string.IsNullOrWhiteSpace(errorList.ToString());
        var statusZero = root.TryGetProperty("status", out var status) && status.ToString() == "0";
        return hasErrorList || statusZero || (statusText?.Contains("Invalid Request", StringComparison.OrdinalIgnoreCase) ?? false);
    }

    public static string SanitizePreview(string value)
    {
        var oneLine = value.Replace("\r", " ").Replace("\n", " ");
        return oneLine.Length <= 300 ? oneLine : oneLine[..300] + "...";
    }
}
