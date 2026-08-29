namespace Imply.TallyConnector;

public interface ITallyInventoryReader
{
    Task<IReadOnlyList<TallyStockItem>> ReadInventoryAsync(CancellationToken cancellationToken);
    Task<DiagnosticReport> RunDiagnosticAsync(DiagnosticOptions options, CancellationToken cancellationToken);
}
