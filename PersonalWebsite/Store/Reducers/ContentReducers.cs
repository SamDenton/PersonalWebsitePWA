using Fluxor;
using PersonalWebsite.Store.State;
using PersonalWebsite.Store.Actions;
using Newtonsoft.Json;
using PersonalWebsite.Store.Effects;
using System.Net.Http;
using PersonalWebsite.Shared.Model;

namespace PersonalWebsite.Store.Reducers
{
	public static class ContentReducers
	{
		[ReducerMethod]
		public static ContentState ReduceLoadContentsFromRepoSuccessAction(ContentState state, LoadContentsFromRepoSuccessAction action)
		{
			return state with { FileCount = action.FileCount };
		}

		[ReducerMethod]
		public static ContentState ReduceFileContentFetchedAction(ContentState state, FileContentFetchedAction action)
		{
			var updatedContents = new List<contentHolder>(state.Contents);
			var updatedIsEditing = new List<bool>(state.IsEditing);

			int startId = updatedContents.Count;  // current count will be the starting index for new items
			for (int i = 0; i < action.FileContents.Count; i++)
			{
				action.FileContents[i].id = startId + i;
				updatedContents.Add(action.FileContents[i]);
				updatedIsEditing.Add(false);  // default to not editing for new content
			}

			return state with { Contents = updatedContents, IsEditing = updatedIsEditing, LoadedFilesCount = state.LoadedFilesCount + 1 };
		}
		[ReducerMethod]
		public static ContentState ReduceUpdateIsEditingAction(ContentState state, UpdateIsEditingAction action)
		{
			//Console.WriteLine($"IsEditing size: {state.IsEditing.Count}, received index: {action.Index}");
			var updatedIsEditing = new List<bool>(state.IsEditing);
			updatedIsEditing[action.Index] = action.IsEditing;

			return new ContentState(state.Contents, state.ShaDictionary, updatedIsEditing, state.FileCount, state.LoadedFilesCount);
		}
		[ReducerMethod]
		public static ContentState ReduceResetIsEditingAction(ContentState state, ResetIsEditingAction action)
		{
			var updatedIsEditing = new List<bool>(state.IsEditing.Count);
			for (int i = 0; i < state.IsEditing.Count; i++)
			{
				updatedIsEditing.Add(false);
			}
			return state with { IsEditing = updatedIsEditing };
		}
		[ReducerMethod]
		public static ContentState ReduceSaveContentAction(ContentState state, SaveContentAction action)
		{
			var updatedContents = new List<contentHolder>(state.Contents);

			var index = updatedContents.FindIndex(x => x.id == action.Index);
			if (index != -1 && !Equals(updatedContents[index], action.TempContent))
			{
				updatedContents[index] = action.TempContent;
			}
			return state with { Contents = updatedContents };
		}
        [ReducerMethod]
        public static ContentState ReduceUpdateShaDictionaryAction(ContentState state, UpdateShaDictionaryAction action)
        {
            var updatedShaDictionary = state.ShaDictionary is null
                ? new Dictionary<string, string>()
                : new Dictionary<string, string>(state.ShaDictionary);

            // Log only the entry being added or updated
            // Console.WriteLine($"Adding/updating ShaDictionary entry: Key='{action.Section}', Value='{action.Sha}'");

            updatedShaDictionary[action.Section] = action.Sha;

            return state with { ShaDictionary = updatedShaDictionary };
        }
    }
}