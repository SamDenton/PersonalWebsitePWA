using Microsoft.AspNetCore.Components;
using Microsoft.JSInterop;

namespace PersonalWebsite.Pages.ConverterComponents
{
    public abstract class ConverterBase : ComponentBase
    {
        [Parameter] public Guid InstanceId { get; set; }
        [Parameter] public EventCallback<Guid> OnClose { get; set; }

        public abstract string Name { get; }
        public string Result { get; protected set; }

        [Inject] protected IJSRuntime JSRuntime { get; set; }

        protected ElementReference CalculatorElement;

        protected override async Task OnAfterRenderAsync(bool firstRender)
        {
            if (firstRender)
            {
                await JSRuntime.InvokeVoidAsync("interop.makeDraggableResizable", $"calculator-{InstanceId}");
            }
        }

        protected void Close()
        {
            if (OnClose.HasDelegate)
            {
                OnClose.InvokeAsync(InstanceId);
            }
        }
    }
}
