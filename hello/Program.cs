public static class Program
{
    private static readonly Greeter.Greeter _greeter = new();

    public static string GetOutput(string name = "World") => _greeter.Greet(name);

    public static void Main(string[] args)
    {
        string name = args.Length > 0 ? args[0] : "World";
        Console.WriteLine(_greeter.Greet(name));
    }
}
