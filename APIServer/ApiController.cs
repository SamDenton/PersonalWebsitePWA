using Microsoft.AspNetCore.Mvc;
using System.Net.Http.Headers;

[ApiController]
[Route("api/[controller]")]
public class GitHubController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly string _githubApiKey;

    public GitHubController(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient();
        _githubApiKey = Environment.GetEnvironmentVariable("GITHUB_API_KEY");
    }

    [HttpGet("repos/{user}/{repo}")]
    public async Task<IActionResult> GetRepository(string user, string repo)
    {
        _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("token", _githubApiKey);

        var response = await _httpClient.GetAsync($"https://api.github.com/repos/{user}/{repo}");
        response.EnsureSuccessStatusCode();

        var repository = await response.Content.ReadAsStringAsync();
        return Ok(repository);
    }
}
