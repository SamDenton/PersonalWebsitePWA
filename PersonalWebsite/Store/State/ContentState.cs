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
			IsEditing = new List<bool>();
			FileCount = 0;
			LoadedFilesCount = 0;
		}

		public ContentState(List<contentHolder> contents, List<bool> isEditing, int fileCount, int loadedFilesCount)
		{
			Contents = contents;
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

			return new ContentState(contents, isEditing, 0, 0);
		}
	}
}
