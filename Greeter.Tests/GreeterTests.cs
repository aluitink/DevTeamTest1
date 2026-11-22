namespace Greeter.Tests;

public class GreeterTests
{
    private readonly Greeter _greeter = new();

    [Fact]
    public void Greet_World_Returns_Hello_World_Exclamation()
    {
        Assert.Equal("Hello, World!", _greeter.Greet("World"));
    }

    [Fact]
    public void Greet_EmptyString_Returns_Hello_Exclamation()
    {
        Assert.Equal("Hello, !", _greeter.Greet(""));
    }

    [Fact]
    public void Greet_Null_Returns_Hello_Exclamation()
    {
        Assert.Equal("Hello, !", _greeter.Greet(null!));
    }
}
