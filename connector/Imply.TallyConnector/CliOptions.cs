namespace Imply.TallyConnector;

public enum ConnectorCommand
{
    Help,
    Diagnostic,
    Run,
    Unknown
}

public sealed record CliOptions(ConnectorCommand Command, bool Upload, bool SaveResponse, string? UnknownCommand)
{
    public static CliOptions Parse(string[] args)
    {
        if (args.Length == 0 || args[0].Equals("--help", StringComparison.OrdinalIgnoreCase) || args[0].Equals("-h", StringComparison.OrdinalIgnoreCase))
        {
            return new CliOptions(ConnectorCommand.Help, false, false, null);
        }

        var command = args[0].ToLowerInvariant();
        var flags = args.Skip(1).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return command switch
        {
            "diagnostic" => new CliOptions(ConnectorCommand.Diagnostic, flags.Contains("--upload"), flags.Contains("--save-response"), null),
            "run" => new CliOptions(ConnectorCommand.Run, false, false, null),
            _ => new CliOptions(ConnectorCommand.Unknown, false, false, args[0])
        };
    }

    public static string Usage =>
        """
        IMPLY Tally Connector

        Usage:
          Imply.TallyConnector --help
          Imply.TallyConnector diagnostic
          Imply.TallyConnector diagnostic --save-response
          Imply.TallyConnector diagnostic --upload
          Imply.TallyConnector run

        Commands:
          --help       Show this help and exit.
          diagnostic   Run one read-only local Tally diagnostic and exit. Does not contact the cloud unless --upload is supplied.
          run          Start the continuous connector worker.
        """;
}
