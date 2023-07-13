using PersonalWebsite.Shared.Model;

namespace PersonalWebsite.Store.Actions
{
    public record LoadContentsFromRepoAction();
    public record LoadContentsFromRepoSuccessAction
    {
        public int FileCount { get; init; }

        public LoadContentsFromRepoSuccessAction(int fileCount)
        {
            FileCount = fileCount;
        }
    }
    public record FetchFileContentsAction
    {
        public string FileUrl { get; init; }
        public string FileNameWithoutSuffix { get; init; }

        public FetchFileContentsAction(string fileUrl, string fileNameWithoutSuffix)
        {
            FileUrl = fileUrl;
            FileNameWithoutSuffix = fileNameWithoutSuffix;
        }
    }
    public record FileContentFetchedAction
    {
        public string FileNameWithoutSuffix { get; init; }
        public List<contentHolder> FileContents { get; init; }

        public FileContentFetchedAction(string fileNameWithoutSuffix, List<contentHolder> fileContents)
        {
            FileNameWithoutSuffix = fileNameWithoutSuffix;
            FileContents = fileContents;
        }
    }
    public record AllFilesFetchedAction();
	//public record UpdateTempContentAction(int Id, string UpdatedContent, bool IsEditing);
	public record UpdateIsEditingAction(int Index, bool IsEditing);
	public record ResetIsEditingAction();
	public class SaveContentAction
	{
		public SaveContentAction(string username, int index, contentHolder tempContent)
		{
			Username = username;
			Index = index;
			TempContent = tempContent;
		}

		public string Username { get; }
		public int Index { get; }
		public contentHolder TempContent { get; }
	}
	public class UpdateGitHubContentAction
	{
		public UpdateGitHubContentAction(List<contentHolder> contentHolders, string commitMessage, string page, string section, Dictionary<string, string> shaDictionary)
		{
			ContentHolders = contentHolders;
			CommitMessage = commitMessage;
			Page = page;
			Section = section;
			ShaDictionary = shaDictionary;
		}

		public List<contentHolder> ContentHolders { get; }
		public string CommitMessage { get; }
		public string Page { get; }
		public string Section { get; }
		public Dictionary<string, string> ShaDictionary { get; }
	}
	public record DeleteFileOnGithubAction(string CommitMessage, string Section, string Sha);
	public class UpdateShaDictionaryAction
	{
		public UpdateShaDictionaryAction(string section, string sha)
		{
			Section = section;
			Sha = sha;
		}

		public string Section { get; }
		public string Sha { get; }
	}
}
