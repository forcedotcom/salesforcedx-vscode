@IsTest
public class ExampleClassTest {
	@IsTest
	static void validateSayHello() {
		String result = ExampleClass.SayHello('Cody');
		System.assertEquals('Hello, Cody!', result, 'SayHello should greet the name');

	}
}