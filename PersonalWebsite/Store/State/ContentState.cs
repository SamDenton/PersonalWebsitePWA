using Fluxor;
using PersonalWebsite.Shared.Model;
using System.Collections.Generic;

namespace PersonalWebsite.Store.State
{
    public record ContentState
    {
        public List<contentHolder> Contents { get; init; }
        public int FileCount { get; init; }
        public int LoadedFilesCount { get; init; }

        public ContentState()
        {
            Contents = new List<contentHolder>();
            FileCount = 0;
            LoadedFilesCount = 0;
        }

        public ContentState(List<contentHolder> contents, int fileCount, int loadedFilesCount)
        {
            Contents = contents;
            FileCount = fileCount;
            LoadedFilesCount = loadedFilesCount;
        }
    }


    public class ContentFeature : Feature<ContentState>
    {
        public override string GetName() => "Content";

        protected override ContentState GetInitialState()
        {
            return new ContentState(new List<contentHolder>(), 0, 0);
        }
    }
}
