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

		//[ReducerMethod]
		//public static ContentState ReduceUpdateTempContentAction(ContentState state, UpdateTempContentAction action)
		//{
		//	var updatedContents = new List<contentHolder>(state.Contents);
		//	var updatedIsEditing = new List<bool>(state.IsEditing);
		//	var indexToUpdate = updatedContents.FindIndex(c => c.id == action.Id);
		//	if (indexToUpdate != -1)
		//	{
		//		var contentToUpdate = updatedContents[indexToUpdate];
		//		updatedContents[indexToUpdate] = new contentHolder
		//		{
		//			page = contentToUpdate.page,
		//			section = contentToUpdate.section,
		//			subSection = contentToUpdate.subSection,
		//			content = action.UpdatedContent,
		//			id = contentToUpdate.id
		//		};

		//		updatedIsEditing[indexToUpdate] = action.IsEditing;
		//	}

		//	return new ContentState(updatedContents, updatedIsEditing, state.FileCount, state.LoadedFilesCount);
		//}
		[ReducerMethod]
		public static ContentState ReduceUpdateIsEditingAction(ContentState state, UpdateIsEditingAction action)
		{
			Console.WriteLine($"IsEditing size: {state.IsEditing.Count}, received index: {action.Index}");
			var updatedIsEditing = new List<bool>(state.IsEditing);
			updatedIsEditing[action.Index] = action.IsEditing;

			return new ContentState(state.Contents, updatedIsEditing, state.FileCount, state.LoadedFilesCount);
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

	}
}