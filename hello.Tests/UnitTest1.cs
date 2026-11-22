public class OutputTests
{
    [Fact]
    public void Hello_Output_Is_Hello_World()
    {
        Assert.Equal("Hello World", Program.GetOutput());
    }
}
