public class BasicVariables {
	class MyInnerClass {
		Integer myInteger;
		String myString;
		public MyInnerClass(Integer myInteger, String myString) {
			this.myInteger = myInteger;
			this.myString = myString;
		}
	}
  
	public enum Season {WINTER, SPRING, SUMMER, FALL}

	public static void testAll() {
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

		MyInnerClass myClass = new MyInnerClass(1, 'One');
	
		List<Integer> mySimpleList = new List<Integer> {1, 2};
		List<MyInnerClass> myComplexList = new List<MyInnerClass> {new MyInnerClass(1, 'One'), new MyInnerClass(2, 'Two')};
		List<List<String>> myNestedList = new List<List<String>>();
		myNestedList.add(new List<String> {'a', 'b'});
		myNestedList.add(new List<String> {'c', 'e'});
		myNestedList.add(new List<String> {'d', 'f'});
	
		Map<Integer, String> mySimpleMap = new Map<Integer, String> {1 => 'One', 2 => 'Two'};
		Map<Integer, MyInnerClass> myComplexMap = new Map<Integer, MyInnerClass> {1 => new MyInnerClass(1, 'One'), 2 => new MyInnerClass(2, 'Two')};

		Set<Integer> mySimpleSet = new Set<Integer>(new List<Integer> {1, 2, 1});
		Set<MyInnerClass> myComplexSet = new Set<MyInnerClass>(new List<MyInnerClass> {new MyInnerClass(1, 'One'), new MyInnerClass(2, 'Two')});

		System.debug('End placeholder for setting breakpoint');
	}
}
