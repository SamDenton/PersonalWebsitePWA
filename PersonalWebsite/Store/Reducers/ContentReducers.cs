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
            updatedContents.AddRange(action.FileContents);
            return state with { Contents = updatedContents, LoadedFilesCount = state.LoadedFilesCount + 1 };
        }
    }

}