using PersonalWebsite.Shared.Model;
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
