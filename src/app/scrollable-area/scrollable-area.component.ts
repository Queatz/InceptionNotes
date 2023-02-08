import {AfterViewInit, Component, EventEmitter, HostListener, Input, Output, ViewChild, ViewContainerRef} from '@angular/core'

@Component({
  selector: 'app-scrollable-area',
  templateUrl: './scrollable-area.component.html',
  styleUrls: ['./scrollable-area.component.css']
})
export class ScrollableAreaComponent implements  AfterViewInit {

  private scrollX = 0

  @Input() orientation: 'horizontal' | 'vertical' = 'horizontal'
  @Input() pin: 'left' | 'right' | 'center' = 'center'
  @Output() offset = new EventEmitter<number>()

  @ViewChild('viewport', {read: ViewContainerRef, static: true})
  private viewport: ViewContainerRef

  private oldWidth?: number

  constructor(private scroll: ViewContainerRef) {}

  ngAfterViewInit() {
    this.scroll.element.nativeElement.scrollLeft = this.scroll.element.nativeElement.scrollWidth / 4
    new ResizeObserver(event => { this.onScrolled(event[0].borderBoxSize?.[0]?.inlineSize) })
      .observe(this.scroll.element.nativeElement, { box: 'border-box' })
  }

  @HostListener('scroll')
  private onScrolled(newWidth?: number) {
    let resizeScrollAmount = 0

    if (newWidth) {
      if (this.oldWidth) {
        if (this.pin === 'left') {
          resizeScrollAmount = Math.round((this.oldWidth - newWidth) / 2)
        } else if (this.pin === 'right') {
          resizeScrollAmount = Math.round((newWidth - this.oldWidth) / 2)
        }
      }
      this.oldWidth = newWidth
    }

    const scrollLeft = Math.round(this.scroll.element.nativeElement.scrollWidth / 4)
    const x = Math.round(resizeScrollAmount + (scrollLeft - this.scroll.element.nativeElement.scrollLeft))

    if (Math.abs(x) >= 1) {
      this.scrollX += x
      this.offset.emit(-this.scrollX)
    }

    this.updateElements()

    this.scroll.element.nativeElement.scrollLeft = scrollLeft
  }

  scrollTo(x: number) {
    this.scrollX = x
    this.offset.emit(-this.scrollX)
    this.updateElements()
  }

  private updateElements() {
    this.viewport.element.nativeElement.childNodes.forEach(element => {
      if (element instanceof HTMLElement) {
        element.style.transform = `translateX(${this.scrollX}px)`
      }
    })
  }
}
