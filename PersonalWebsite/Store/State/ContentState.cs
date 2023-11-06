using Fluxor;
using PersonalWebsite.Shared.Model;
using System.Collections.Generic;

namespace PersonalWebsite.Store.State
{
	public record ContentState
	{
		public List<contentHolder> Contents { get; init; }
		public List<bool> IsEditing { get; init; }
		public int FileCount { get; init; }
		public int LoadedFilesCount { get; init; }
		public Dictionary<string, string> ShaDictionary { get; init; }
		public ContentState()
		{
			Contents = new List<contentHolder>();
			ShaDictionary = new Dictionary<string, string>();
			IsEditing = new List<bool>();
			FileCount = 0;
			LoadedFilesCount = 0;
		}

		public ContentState(List<contentHolder> contents, Dictionary<string, string> shaDictionary, List<bool> isEditing, int fileCount, int loadedFilesCount)
		{
			Contents = contents;
			ShaDictionary = shaDictionary;
			IsEditing = isEditing;
			FileCount = fileCount;
			LoadedFilesCount = loadedFilesCount;
		}
	}

	public class ContentFeature : Feature<ContentState>
	{
		public override string GetName() => "Content";

        protected override ContentState GetInitialState()
        {
            var contents = new List<contentHolder>();
            var isEditing = new List<bool>(new bool[contents.Count]);
            var shaDictionary = new Dictionary<string, string>(); // Initialize the ShaDictionary here

            return new ContentState
            {
                Contents = contents,
                IsEditing = isEditing,
                FileCount = 0,
                LoadedFilesCount = 0,
                ShaDictionary = shaDictionary // Set the initialized ShaDictionary
            };
        }
    }
}
