namespace Imply.TallyConnector;

public sealed class ConnectorOptions
{
    public string TallyLocalUrl { get; init; } = "http://localhost:9000";
    public string TallyCompanyName { get; init; } = "";
    public string CloudApiBaseUrl { get; init; } = "";
    public string ConnectorId { get; init; } = "";
    public int SyncIntervalSeconds { get; init; } = 120;
    public int HttpTimeoutSeconds { get; init; } = 30;
    public bool PreferJson { get; init; } = false;

    public string? ConnectorSecret => Environment.GetEnvironmentVariable("IMPLY_CONNECTOR_SECRET");
}
