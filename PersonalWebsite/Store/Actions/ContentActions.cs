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
}
