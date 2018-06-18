public class StaticVarsA {
    public static String className = 'StaticVarsA';
    
    public static void method1() {
        StaticVarsB.method1();
    }
    
    public static void method2() {
        System.debug('placeholder');
    }
}