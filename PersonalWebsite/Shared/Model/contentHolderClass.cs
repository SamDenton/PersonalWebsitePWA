namespace PersonalWebsite.Shared.Model
{
    //Not currently in use, but if I decide to sync contentHolderList accross components, this is how.  Will need to update with any properties added since creation
    public class contentHolderClass
    {
        public string? page { get; set; }

        public string? section { get; set; }

        public string? subSection { get; set; }

        public string? content { get; set; }
    }
}
