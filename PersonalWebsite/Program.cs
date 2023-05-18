using PersonalWebsite;
using PersonalWebsite.Shared;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using static PersonalWebsite.Pages.MainContent;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");
//Console.WriteLine("test");
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
//Console.WriteLine("test2");
builder.Services.AddSingleton<contentHolder>();
//Console.WriteLine("test3");
builder.Services.AddSingleton<MyStateContainer>();

builder.Services.AddMsalAuthentication(options => {
    builder.Configuration.Bind("AzureAd", options.ProviderOptions.Authentication);
    options.ProviderOptions.DefaultAccessTokenScopes.Add("api://a90ff01b-640d-478f-8f16-05fe599a6574/Files.Read");
    options.ProviderOptions.LoginMode = "redirect";
    //Console.WriteLine("test6");
});
//Console.WriteLine("test7");
await builder.Build().RunAsync();
//Console.WriteLine("test8");