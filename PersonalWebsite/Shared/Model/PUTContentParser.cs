namespace PersonalWebsite.Shared.Model
{
	public class PUTContentParser
	{
		public Content content { get; set; }
		public Commit commit { get; set; }
	}
	public class Content
	{
		public string sha { get; set; }
	}
	public class Commit
	{
		public string sha { get; set; }
	}
}
