using PersonalWebsite;
using PersonalWebsite.Shared;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using static PersonalWebsite.Pages.MainContent;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
//builder.Services.AddSingleton<ContentHolderState>();
builder.Services.AddSingleton<contentHolder>();
builder.Services.AddSingleton<MyStateContainer>();
builder.Services.AddMsalAuthentication(options =>
{
    builder.Configuration.Bind("AzureAd", options.ProviderOptions.Authentication);
});

builder.Services.AddMsalAuthentication(options => {
    builder.Configuration.Bind("AzureAd", options.ProviderOptions.Authentication); 
    options.ProviderOptions.DefaultAccessTokenScopes.Add("api://e6dd03c8-eff6-4110-a4e6-793dfaddf9fb/API.Access2"); 
    options.ProviderOptions.LoginMode = "redirect";
});

await builder.Build().RunAsync();
