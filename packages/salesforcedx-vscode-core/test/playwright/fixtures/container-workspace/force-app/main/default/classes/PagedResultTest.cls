@isTest
private class PagedResultTest {
    @isTest
    static void holdsPageMetadata() {
        PagedResult result = new PagedResult();
        result.pageSize = 10;
        result.pageNumber = 1;
        result.totalItemCount = 42;
        result.records = new List<Object>();

        System.assertEquals(10, result.pageSize, 'pageSize round-trips');
        System.assertEquals(1, result.pageNumber, 'pageNumber round-trips');
        System.assertEquals(42, result.totalItemCount, 'totalItemCount round-trips');
        System.assertEquals(0, result.records.size(), 'records starts empty');
    }
}
