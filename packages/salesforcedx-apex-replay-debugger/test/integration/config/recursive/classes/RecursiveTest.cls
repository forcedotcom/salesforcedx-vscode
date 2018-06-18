@IsTest
public class RecursiveTest {
    @IsTest
    public static void testMain() {
        B myB = new B();
        A myA = new A(myB);
        System.debug('placeholder');
    }
}