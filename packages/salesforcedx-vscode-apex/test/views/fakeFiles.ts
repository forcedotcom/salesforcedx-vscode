const FILE_0 = `public class file0 {
    @isTest static void test0() {
        Systme.assertEquals(0,0);
    }
    @isTest static void test1() {
        System.assertEquals(1,1);
    }
    static void notTest() {
        Decimal celsius = TemperatureConverter.FahrenheitToCelsius(212);
        System.assertEquals(100,celsius,'Boiling point temperature is not expected.');
    }
    static void notTest() {
        Decimal celsius = TemperatureConverter.FahrenheitToCelsius(-10);
        System.assertEquals(-23.33,celsius);
    }
}`;

const FILE_1 = `public class file1 {
    @isTest static void test2() {
        Systme.assertEquals(0,0);
    }
    @isTest static void test3() {
        System.assertEquals(1,1);
    }
    static void notTest() {
        Decimal celsius = TemperatureConverter.FahrenheitToCelsius(212);
        System.assertEquals(100,celsius,'Boiling point temperature is not expected.');
    }
    static void notTest() {
        Decimal celsius = TemperatureConverter.FahrenheitToCelsius(-10);
        System.assertEquals(-23.33,celsius);
    }
}`;

const FILE_2 = `public class file2 {
    @isTest static void test4() {
        Systme.assertEquals(0,0);
    }
    @isTest static void test5() {
        System.assertEquals(1,1);
    }
    static void notTest() {
        Decimal celsius = TemperatureConverter.FahrenheitToCelsius(212);
        System.assertEquals(100,celsius,'Boiling point temperature is not expected.');
    }
    static void notTest() {
        Decimal celsius = TemperatureConverter.FahrenheitToCelsius(-10);
        System.assertEquals(-23.33,celsius);
    }
}`;

const FILE_3 = `public class file3 {
    @isTest static void test6() {
        Systme.assertEquals(0,0);
    }
    @isTest static void test7() {
        System.assertEquals(1,1);
    }
    static void notTest() {
        Decimal celsius = TemperatureConverter.FahrenheitToCelsius(212);
        System.assertEquals(100,celsius,'Boiling point temperature is not expected.');
    }
    static void notTest() {
        Decimal celsius = TemperatureConverter.FahrenheitToCelsius(-10);
        System.assertEquals(-23.33,celsius);
    }
}`;

export const files = [FILE_0, FILE_1, FILE_2, FILE_3];
