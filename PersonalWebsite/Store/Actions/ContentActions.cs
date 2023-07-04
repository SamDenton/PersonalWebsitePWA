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
        public string FileSha { get; init; }
        public List<contentHolder> FileContents { get; init; }

        public FileContentFetchedAction(string fileNameWithoutSuffix, string fileSha, List<contentHolder> fileContents)
        {
            FileNameWithoutSuffix = fileNameWithoutSuffix;
            FileSha = fileSha;
            FileContents = fileContents;
        }
    }
    public record AllFilesFetchedAction();
	public record UpdateTempContentAction(int Id, string UpdatedContent, bool IsEditing);
	public record UpdateIsEditingAction(int Index, bool IsEditing);
	public record ResetIsEditingAction();
	public class SaveContentAction
	{
		public string Username { get; set; }
		public int GlobalSectionNo { get; set; }
		public bool NewSec { get; set; }

		public SaveContentAction(string username, int globalSectionNo, bool newSec)
		{
			Username = username;
			GlobalSectionNo = globalSectionNo;
			NewSec = newSec;
		}
	}
	public record SaveNewSectionAction(int GlobalSectionNo, string Username, List<contentHolder> Content, string Sha);
	public record SaveExistingSectionAction(int GlobalSectionNo, string Username, List<contentHolder> Content, string Sha);
	public record SaveOutdatedSectionAction(int GlobalSectionNo, string Username, List<contentHolder> Content, string Sha);
	public record UpdateContentOnGithubAction(string JsonString, string CommitMessage, string Section, string Sha);
	public record DeleteFileOnGithubAction(string CommitMessage, string Section, string Sha);

}
