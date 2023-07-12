using PersonalWebsite;
using PersonalWebsite.Shared;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using PersonalWebsite.Shared.Model;
using Fluxor;
using PersonalWebsite.Store.Actions;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");
builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });

builder.Services.AddMsalAuthentication(options => {
	builder.Configuration.Bind("AzureAd", options.ProviderOptions.Authentication);
	options.ProviderOptions.DefaultAccessTokenScopes.Add("api://a90ff01b-640d-478f-8f16-05fe599a6574/Files.Read");
	options.ProviderOptions.LoginMode = "redirect";
});
builder.Services.AddFluxor(o => o.ScanAssemblies(typeof(Program).Assembly));

// build the host
var host = builder.Build();

// resolve the dispatcher
var dispatcher = host.Services.GetRequiredService<IDispatcher>();

// dispatch the LoadContentsFromRepoAction
dispatcher.Dispatch(new LoadContentsFromRepoAction());

// Run the app
await host.RunAsync();
