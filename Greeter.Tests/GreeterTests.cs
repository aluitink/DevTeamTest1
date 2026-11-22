namespace Greeter.Tests;

public class GreeterTests
{
    private readonly Greeter _greeter = new();

    [Fact]
    public void Greet_World_Returns_Hello_World_Exclamation()
    {
        Assert.Equal("Hello, World!", _greeter.Greet("World"));
    }
}
