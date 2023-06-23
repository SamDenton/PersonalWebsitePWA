//using PersonalWebsite.Shared.Model;
//Currently, this state continer just pings other components when an update is detected.
//If I want to actually maintain contentHolderList with it, I need the above using, and the contentHolderClass.cs in the shred.model namespace
namespace PersonalWebsite.Shared
{
    public class MyStateContainer
    {
        /*public contentHolder[] Value { get; set; }
        public event Action OnStateChange;
        public void SetValue(contentHolder[] value)
        {
            this.Value = value;
            NotifyStateChanged();
        }
        */
        public event Action OnStateChange;
        public void SetValue()
        {
            NotifyStateChanged();
        }
        private void NotifyStateChanged() => OnStateChange?.Invoke();
    }
}
