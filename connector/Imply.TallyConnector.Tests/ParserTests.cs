using Xunit;
namespace Imply.TallyConnector.Tests;


public sealed class ParserTests
{
    [Fact]
    public void JsonParserReadsItemsAndGodowns()
    {
        const string json = """
        {"items":[{"name":"IMPLY ROYAL 18MM 8X4 BWP","closingBalance":"42 sheets","unit":"sheets","godowns":[{"name":"RR Nagar","quantity":"30 sheets"},{"name":"Main","quantity":"12 sheets"}]}]}
        """;
        var items = TallyJsonParser.ParseStockItems(json);
        Assert.Single(items);
        Assert.Equal(42, items[0].TotalQuantity);
        Assert.Equal(2, items[0].Godowns.Count);
    }

    [Fact]
    public void XmlParserReadsItems()
    {
        const string xml = """
        <ENVELOPE><STOCKITEM NAME="IMPLY PLUS 18MM 8X4 BWR"><BASEUNITS>sheets</BASEUNITS><CLOSINGBALANCE>8 sheets</CLOSINGBALANCE></STOCKITEM></ENVELOPE>
        """;
        var items = TallyXmlParser.ParseStockItems(xml);
        Assert.Single(items);
        Assert.Equal("IMPLY PLUS 18MM 8X4 BWR", items[0].TallyItemName);
        Assert.Equal(8, items[0].TotalQuantity);
    }

    [Fact]
    public void XmlParserReadsRealisticInventoryWithUnicodeSignedDecimalsAndGodowns()
    {
        const string xml = """
        <ENVELOPE>
          <BODY>
            <DATA>
              <COLLECTION>
                <STOCKITEM NAME="IMPLY ROYAL 18MM 8×4 BWP">
                  <BASEUNITS>sheets</BASEUNITS>
                  <CLOSINGBALANCE>-12.50 sheets</CLOSINGBALANCE>
                  <GODOWNALLOCATIONS.LIST>
                    <GODOWNNAME>RR Nagar</GODOWNNAME>
                    <CLOSINGBALANCE>-10.25 sheets</CLOSINGBALANCE>
                  </GODOWNALLOCATIONS.LIST>
                  <GODOWNALLOCATIONS.LIST>
                    <GODOWNNAME>Main</GODOWNNAME>
                    <CLOSINGBALANCE>-2.25 sheets</CLOSINGBALANCE>
                  </GODOWNALLOCATIONS.LIST>
                </STOCKITEM>
              </COLLECTION>
            </DATA>
          </BODY>
        </ENVELOPE>
        """;

        var items = TallyXmlParser.ParseStockItems(xml);

        Assert.Single(items);
        Assert.Equal("IMPLY ROYAL 18MM 8×4 BWP", items[0].TallyItemName);
        Assert.Equal(-12.50m, items[0].TotalQuantity);
        Assert.Equal("sheets", items[0].Unit);
        Assert.Equal(2, items[0].Godowns.Count);
        Assert.Equal(-10.25m, items[0].Godowns[0].Quantity);
    }

    [Fact]
    public void JsonParserReadsZeroNegativeAndDecimalQuantities()
    {
        const string json = """
        {"items":[{"name":"Zero","closingBalance":"0 sheets","unit":"sheets"},{"name":"Negative","closingBalance":"-1.75 sheets","unit":"sheets"}]}
        """;

        var items = TallyJsonParser.ParseStockItems(json);

        Assert.Equal(2, items.Count);
        Assert.Equal(0, items[0].TotalQuantity);
        Assert.Equal(-1.75m, items[1].TotalQuantity);
    }

    [Fact]
    public void TallyErrorResponseIsFailureEvenWhenHttpStatusWas200()
    {
        const string xml = "<ENVELOPE><BODY><DATA><LINEERROR>Error: company is not loaded</LINEERROR></DATA></BODY></ENVELOPE>";

        var error = Assert.Throws<TallyExtractionException>(() => TallyXmlParser.ParseStockItems(xml));

        Assert.Equal("tally_error", error.Kind);
    }

    [Fact]
    public void EmptyInventoryIsDifferentFromMalformedResponse()
    {
        const string empty = "{\"items\":[]}";
        const string malformed = "{\"status\":\"ok\"}";

        Assert.Empty(TallyJsonParser.ParseStockItems(empty));
        var error = Assert.Throws<TallyExtractionException>(() => TallyJsonParser.ParseStockItems(malformed));
        Assert.Equal("malformed_response", error.Kind);
    }

    [Fact]
    public void JsonStatusZeroMissingTallyRequestIsRequestRejected()
    {
        const string json = """
        {"status":0,"error_list":"Invalid Request Format, Missing tallyrequest"}
        """;

        var error = Assert.Throws<TallyExtractionException>(() => TallyJsonParser.ParseStockItems(json));
        var inspection = TallyJsonParser.Inspect(json);

        Assert.Equal("request_rejected", error.Kind);
        Assert.Equal("request_rejected", inspection.Kind);
        Assert.Contains("status", inspection.RootNames);
        Assert.Contains("error_list", inspection.RootNames);
    }

    [Fact]
    public void JsonRequestContainsTallyRequestEnvelopeFields()
    {
        var request = JsonRequests.StockSummary("Demo Company");

        Assert.Contains("\"tallyrequest\":\"Export\"", request);
        Assert.Contains("\"type\":\"Collection\"", request);
        Assert.Contains("\"id\":\"IMPLYStockItems\"", request);
    }

    [Fact]
    public void XmlCmpInfoOnlyStockItemIsProcessingResponse()
    {
        const string xml = """
        <ENVELOPE>
          <BODY>
            <DESC>
              <CMPINFO>
                <STOCKITEM>0</STOCKITEM>
              </CMPINFO>
            </DESC>
          </BODY>
        </ENVELOPE>
        """;

        var error = Assert.Throws<TallyExtractionException>(() => TallyXmlParser.ParseStockItems(xml));
        var inspection = TallyXmlParser.Inspect(xml);

        Assert.Equal("processing_response", error.Kind);
        Assert.Equal("processing_response", inspection.Kind);
    }

    [Fact]
    public void XmlRequestIsExportCollectionEnvelope()
    {
        var request = XmlRequests.StockSummary("Demo & Sons");

        Assert.Contains("<TALLYREQUEST>Export Data</TALLYREQUEST>", request);
        Assert.Contains("<TYPE>Collection</TYPE>", request);
        Assert.Contains("<ID>IMPLYStockItems</ID>", request);
        Assert.Contains("<SVCURRENTCOMPANY>Demo &amp; Sons</SVCURRENTCOMPANY>", request);
        Assert.Contains("<TYPE>Stock Item</TYPE>", request);
        Assert.DoesNotContain("Ledger", request);
        Assert.DoesNotContain("Voucher", request);
    }

    [Fact]
    public void XmlEmptyInventoryCollectionIsValidEmptyInventory()
    {
        const string xml = "<ENVELOPE><BODY><DATA><COLLECTION NAME=\"IMPLYStockItems\"></COLLECTION></DATA></BODY></ENVELOPE>";

        var items = TallyXmlParser.ParseStockItems(xml);
        var inspection = TallyXmlParser.Inspect(xml);

        Assert.Empty(items);
        Assert.Equal("empty_inventory", inspection.Kind);
    }

    [Fact]
    public void XmlParserRemovesInvalidControlCharactersBeforeParsing()
    {
        const string xml = """
        <ENVELOPE>
          <BODY>
            <DESC>
              <CMPINFO><LEDGER>247</LEDGER><STOCKITEM>1</STOCKITEM></CMPINFO>
            </DESC>
            <DATA>
              <COLLECTION NAME="IMPLYStockItems">
                <STOCKITEM NAME="IMPLY ROYAL 18MM 8X4 BWP">
                  <BASEUNITS>sheets</BASEUNITS>
                  <CLOSINGBALANCE>42 sheets</CLOSINGBALANCE>
                </STOCKITEM>
              </COLLECTION>
            </DATA>
          </BODY>
        </ENVELOPE>
        """;

        var items = TallyXmlParser.ParseStockItems(xml);
        var inspection = TallyXmlParser.Inspect(xml);

        Assert.Equal(1, TallyXmlParser.CountInvalidXmlCharacters(xml));
        Assert.Single(items);
        Assert.Equal("IMPLY ROYAL 18MM 8X4 BWP", items[0].TallyItemName);
        Assert.Equal("inventory_records", inspection.Kind);
    }

    [Fact]
    public void XmlInvalidCharacterCounterCountsAsciiControlCharacterFour()
    {
        var xml = "<ENVELOPE><BODY>before" + '\u0004' + "after</BODY></ENVELOPE>";

        Assert.Equal(1, TallyXmlParser.CountInvalidXmlCharacters(xml));
        Assert.DoesNotContain('\u0004', TallyXmlParser.RemoveInvalidXmlCharacters(xml));
    }

    [Fact]
    public void XmlParserRemovesInvalidHexNumericCharacterReferencesBeforeParsing()
    {
        const string xml = """
        <ENVELOPE>
          <BODY>
            <DATA>
              <COLLECTION NAME="IMPLYStockItems">
                <STOCKITEM NAME="IMPLY ROYAL 18MM 8&#x04;X4 BWP">
                  <BASEUNITS>sheets</BASEUNITS>
                  <CLOSINGBALANCE>42 sheets</CLOSINGBALANCE>
                </STOCKITEM>
              </COLLECTION>
            </DATA>
          </BODY>
        </ENVELOPE>
        """;

        var items = TallyXmlParser.ParseStockItems(xml);

        Assert.Equal(1, TallyXmlParser.CountInvalidXmlCharacters(xml));
        Assert.Single(items);
        Assert.Equal("IMPLY ROYAL 18MM 8X4 BWP", items[0].TallyItemName);
    }

    [Fact]
    public void XmlParserRemovesInvalidDecimalNumericCharacterReferencesBeforeParsing()
    {
        const string xml = "<ENVELOPE><BODY><DATA><COLLECTION NAME=\"IMPLYStockItems\"><STOCKITEM NAME=\"A&#4;B\"><BASEUNITS>sheets</BASEUNITS><CLOSINGBALANCE>0 sheets</CLOSINGBALANCE></STOCKITEM></COLLECTION></DATA></BODY></ENVELOPE>";

        var items = TallyXmlParser.ParseStockItems(xml);

        Assert.Equal(1, TallyXmlParser.CountInvalidXmlCharacters(xml));
        Assert.Single(items);
        Assert.Equal("AB", items[0].TallyItemName);
    }
}
