using Imply.TallyConnector;
using Microsoft.Extensions.Options;
using Serilog;

var cli = CliOptions.Parse(args);
if (cli.Command == ConnectorCommand.Help)
{
    Console.WriteLine(CliOptions.Usage);
    return 0;
}

if (cli.Command == ConnectorCommand.Unknown)
{
    Console.Error.WriteLine($"Unknown command: {cli.UnknownCommand}");
    Console.Error.WriteLine();
    Console.Error.WriteLine(CliOptions.Usage);
    return 2;
}

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .WriteTo.File("logs/imply-tally-connector-.log", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 30)
    .CreateLogger();

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddSerilog();
builder.Services.AddWindowsService(options => options.ServiceName = "IMPLY Tally Connector");
builder.Services.Configure<ConnectorOptions>(builder.Configuration.GetSection("Connector"));
builder.Services.AddHttpClient<TallyHttpClient>();
builder.Services.AddHttpClient<ICloudApiClient, CloudApiClient>((serviceProvider, client) =>
{
    var connectorOptions = serviceProvider.GetRequiredService<IOptions<ConnectorOptions>>().Value;
    client.Timeout = TimeSpan.FromSeconds(connectorOptions.HttpTimeoutSeconds);
});
builder.Services.AddSingleton<ITallyInventoryReader, JsonTallyInventoryReader>();
builder.Services.AddSingleton<XmlTallyInventoryReader>();
if (cli.Command == ConnectorCommand.Run)
{
    builder.Services.AddHostedService<ConnectorWorker>();
}

var app = builder.Build();
var options = app.Services.GetRequiredService<IOptions<ConnectorOptions>>().Value;

if (cli.Command == ConnectorCommand.Diagnostic)
{
    using var scope = app.Services.CreateScope();
    var diagnostic = ActivatorUtilities.CreateInstance<DiagnosticRunner>(scope.ServiceProvider);
    return await diagnostic.RunAsync(cli.Upload, cli.SaveResponse, CancellationToken.None);
}

var errors = ConnectorConfigurationValidator.ValidateForRun(options);
if (errors.Count > 0)
{
    foreach (var error in errors) Console.Error.WriteLine($"Configuration error: {error}");
    return 1;
}

await app.RunAsync();
return 0;
