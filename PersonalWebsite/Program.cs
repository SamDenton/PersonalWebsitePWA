using PersonalWebsite;
using PersonalWebsite.Shared;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using PersonalWebsite.Shared.Model;
using Fluxor;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

builder.Services.AddSingleton<MyStateContainer>();

builder.Services.AddMsalAuthentication(options => {
    builder.Configuration.Bind("AzureAd", options.ProviderOptions.Authentication);
    options.ProviderOptions.DefaultAccessTokenScopes.Add("api://a90ff01b-640d-478f-8f16-05fe599a6574/Files.Read");
    options.ProviderOptions.LoginMode = "redirect";
});
builder.Services.AddFluxor(o => o.ScanAssemblies(typeof(Program).Assembly));

await builder.Build().RunAsync();
