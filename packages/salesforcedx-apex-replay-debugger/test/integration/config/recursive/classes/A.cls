public class A {
    public class MyInnerClassA {
        private Integer myInteger;
        private String myString;
        
        public MyInnerClassA(Integer myInteger, String myString) {
            this.myInteger = myInteger;
            this.myString = myString;
        }
    }
    
    B myB;
    
    public static MyInnerClassA myClass = new MyInnerClassA(1, 'One');
    public static List<Integer> mySimpleList = new List<Integer> {1, 2};
    public static List<MyInnerClassA> myComplexList = new List<MyInnerClassA> {new MyInnerClassA(1, 'One'), new MyInnerClassA(2, 'Two')};
    public static List<List<String>> myNestedList = new List<List<String>>();
    public static Map<Integer, String> mySimpleMap = new Map<Integer, String> {1 => 'One', 2 => 'Two'};
    public static Map<Integer, MyInnerClassA> myComplexMap = new Map<Integer, MyInnerClassA> {1 => new MyInnerClassA(1, 'One'), 2 => new MyInnerClassA(2, 'Two')};
    public static Set<Integer> mySimpleSet = new Set<Integer>(new List<Integer> {1, 2, 1});
    public static Set<MyInnerClassA> myComplexSet = new Set<MyInnerClassA>(new List<MyInnerClassA> {new MyInnerClassA(1, 'One'), new MyInnerClassA(2, 'Two')});
    
    public enum Season {WINTER, SPRING, SUMMER, FALL}
    
    public A(B myB) {
        this.myB = myB;
        myB.myA = this;
        
        Blob blobVar = Blob.valueOf('Blob');
        Boolean booleanVar = true;
        Date dateVar = Date.newInstance(1990, 1, 3);
        Datetime datetimeVar = Datetime.newInstance(1980, 10, 1);
        Decimal decimalVar = 0.002;
        Double doubleVar = 3.14159;
        Season enumVar = Season.SUMMER;
        ID idVar = UserInfo.getUserId();
        Integer integerVar = 42;
        Long longVar = 123456789L;
        String stringVar = 'Lorem ipsum dolor sit amet, consectetur adipis; elit. Aliquam dictum cursus nulla';
        Time timeVar = Time.newInstance(1, 2, 3, 4);
        
        System.debug('End placeholder for setting breakpoint');
    }
}