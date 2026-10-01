public class B {
    public class MyInnerClassB {
        private Integer myInteger;
        private String myString;
        
        public MyInnerClassB(Integer myInteger, String myString) {
            this.myInteger = myInteger;
            this.myString = myString;
        }
    }
    
    public A myA { get; set; }
    
    public static Blob blobVar = Blob.valueOf('Blob');
    public static Boolean booleanVar = true;
    public static Date dateVar = Date.newInstance(1990, 1, 3);
    public static Datetime datetimeVar = Datetime.newInstance(1980, 10, 1);
    public static Decimal decimalVar = 0.002;
    public static Double doubleVar = 3.14159;
    public static Season enumVar = Season.SUMMER;
    public static ID idVar = UserInfo.getUserId();
    public static Integer integerVar = 42;
    public static Long longVar = 123456789L;
    public static String stringVar = 'Lorem ipsum dolor sit amet, consectetur adipis; elit. Aliquam dictum cursus nulla';
    public static Time timeVar = Time.newInstance(1, 2, 3, 4);
    
    public enum Season {WINTER, SPRING, SUMMER, FALL}
    
    public B() {
        MyInnerClassB myClass = new MyInnerClassB(1, 'One');
        List<Integer> mySimpleList = new List<Integer> {1, 2};
        List<MyInnerClassB> myComplexList = new List<MyInnerClassB> {new MyInnerClassB(1, 'One'), new MyInnerClassB(2, 'Two')};
        List<List<String>> myNestedList = new List<List<String>>();
        myNestedList.add(new List<String> {'a', 'b'});
        myNestedList.add(new List<String> {'c', 'e'});
        myNestedList.add(new List<String> {'d', 'f'});
        Map<Integer, String> mySimpleMap = new Map<Integer, String> {1 => 'One', 2 => 'Two'};
        Map<Integer, MyInnerClassB> myComplexMap = new Map<Integer, MyInnerClassB> {1 => new MyInnerClassB(1, 'One'), 2 => new MyInnerClassB(2, 'Two')};
        Set<Integer> mySimpleSet = new Set<Integer>(new List<Integer> {1, 2, 1});
        Set<MyInnerClassB> myComplexSet = new Set<MyInnerClassB>(new List<MyInnerClassB> {new MyInnerClassB(1, 'One'), new MyInnerClassB(2, 'Two')});
        
        System.debug('End placeholder for setting breakpoint');
    }
}