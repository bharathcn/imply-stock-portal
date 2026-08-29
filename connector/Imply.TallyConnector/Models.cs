using System.Text.Json.Serialization;

namespace Imply.TallyConnector;

public sealed record GodownQuantity(string GodownName, decimal Quantity);

public sealed record TallyStockItem(string TallyItemName, decimal TotalQuantity, string Unit, IReadOnlyList<GodownQuantity> Godowns);

public sealed record InventorySnapshot(
    string ConnectorId,
    Guid RequestId,
    string TallyCompany,
    DateTimeOffset SyncStartedAt,
    DateTimeOffset SyncCompletedAt,
    string ConnectorVersion,
    string? TallyRelease,
    IReadOnlyList<TallyStockItem> Items);

public sealed record Heartbeat(
    string ConnectorId,
    string ConnectorVersion,
    string TallyCompany,
    string? TallyRelease,
    string Status,
    DateTimeOffset? LastSuccessfulSyncAt);

public sealed class DiagnosticReport
{
    public string TallyEndpoint { get; set; } = "";
    public bool TallyReachable { get; set; }
    public int? HttpStatusCode { get; set; }
    public string? ResponseContentType { get; set; }
    public bool CompanyConfigured { get; set; }
    public bool CompanyAppearsLoaded { get; set; }
    public string? TallyRelease { get; set; }
    public string? DetectedResponseFormat { get; set; }
    public string? ResponseKind { get; set; }
    public string? ReaderUsed { get; set; }
    public IReadOnlyList<string> OutgoingRequestPropertyNames { get; set; } = [];
    public IReadOnlyList<string> OutgoingRequestElementNames { get; set; } = [];
    public string? OutgoingRequestKind { get; set; }
    public string? JsonError { get; set; }
    public string? XmlError { get; set; }
    public string? JsonResponseKind { get; set; }
    public string? XmlResponseKind { get; set; }
    public int SampleItemCount { get; set; }
    public IReadOnlyList<string> SampleItemNames { get; set; } = [];
    public int ParsedItemCount { get; set; }
    public bool QuantitiesParsed { get; set; }
    public bool GodownAllocationsParsed { get; set; }
    public IReadOnlyList<string> RootNames { get; set; } = [];
    public string? TallyStatusText { get; set; }
    public string? SanitizedPreview { get; set; }
    public int RemovedInvalidXmlCharacterCount { get; set; }
    public string? SavedResponsePath { get; set; }
    public bool Succeeded { get; set; }
    public string? Error { get; set; }
}

public sealed record TallyHttpResponse(int StatusCode, string? ContentType, string Body, string RequestBody);

public sealed record TallyParseInspection(
    string Format,
    string Kind,
    IReadOnlyList<string> RootNames,
    string? TallyStatusText,
    string? SanitizedPreview);

public sealed class TallyExtractionException(string message, string kind) : InvalidOperationException(message)
{
    public string Kind { get; } = kind;
}

public sealed record DiagnosticOptions(bool SaveResponse);
