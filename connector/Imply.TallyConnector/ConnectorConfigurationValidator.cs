namespace Imply.TallyConnector;

public static class ConnectorConfigurationValidator
{
    public static IReadOnlyList<string> ValidateForRun(ConnectorOptions options)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(options.CloudApiBaseUrl))
        {
            errors.Add("Connector:CloudApiBaseUrl is required in run mode.");
        }
        else if (!Uri.TryCreate(options.CloudApiBaseUrl, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
        {
            errors.Add("Connector:CloudApiBaseUrl must be a valid HTTPS absolute URL.");
        }

        if (string.IsNullOrWhiteSpace(options.ConnectorId)) errors.Add("Connector:ConnectorId is required in run mode.");
        if (string.IsNullOrWhiteSpace(options.ConnectorSecret)) errors.Add("IMPLY_CONNECTOR_SECRET environment variable is required in run mode.");
        if (options.SyncIntervalSeconds <= 0) errors.Add("Connector:SyncIntervalSeconds must be greater than zero.");
        if (options.HttpTimeoutSeconds <= 0) errors.Add("Connector:HttpTimeoutSeconds must be greater than zero.");
        return errors;
    }

    public static IReadOnlyList<string> ValidateForDiagnosticUpload(ConnectorOptions options) => ValidateForRun(options);
}
