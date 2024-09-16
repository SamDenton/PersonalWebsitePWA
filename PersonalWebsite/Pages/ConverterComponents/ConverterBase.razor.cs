using Microsoft.AspNetCore.Components;

namespace PersonalWebsite.Pages.ConverterComponents
{
    public abstract class ConverterBase : ComponentBase
    {
        [Parameter] public Guid InstanceId { get; set; }
        [Parameter] public EventCallback<Guid> OnClose { get; set; }

        public abstract string Name { get; }
        public string Result { get; protected set; }

        protected void Close()
        {
            if (OnClose.HasDelegate)
            {
                OnClose.InvokeAsync(InstanceId);
            }
        }
    }
}
